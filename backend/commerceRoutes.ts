import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  addCartItem,
  addCartExamPackage,
  cancelPendingOrder,
  createClassSession,
  createCourse,
  createPendingOrder,
  deleteClassSession,
  deleteCourse,
  expireStalePendingOrders,
  getCartWithItems,
  getClassSession,
  getOrCreateCart,
  getOrderByCode,
  getOrderByPayosCode,
  listClassSessions,
  listCourses,
  listEnrollmentsByClass,
  listOrders,
  markOrderPaid,
  mergeGuestCartIntoUser,
  removeCartItem,
  updateClassSession,
  updateCourse,
  updateOrderPayment,
  getOrderStats,
} from "./commerceStorage";
import {
  createPayosPaymentLink,
  isPayosConfigured,
  verifyPayosWebhook,
} from "./payos";
import { randomUUID } from "crypto";
import { isPortalId, normalizeAllowedPortals, canAccessPortal } from "@shared/portal";
import { resolveCookieDomain, resolvePublicBaseUrl } from "@shared/origins";
import {
  buildPayosCancelUrl,
  buildPayosReturnUrl,
} from "./payosOrderCode";
import {
  fulfillExamPackageOrder,
  getExamPackageOrderByPayosCode,
} from "./examPackageCheckout";

type SessionReq = Request & {
  session: Request["session"] & {
    user?: {
      id: string;
      role: string;
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
      portals?: string[] | null;
    };
    cartGuestToken?: string;
  };
};

function requireAdminOrManager(req: any, res: any, next: any) {
  const sessionUser = req.session?.user;
  if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = sessionUser;
  next();
}

function sessionAllowedPortals(sessionUser: any) {
  return normalizeAllowedPortals(sessionUser?.portals);
}

function denyPortalAccess(res: Response) {
  return res.status(403).json({ message: "Bạn không có quyền truy cập portal này" });
}

function ensureGuestToken(req: SessionReq, res: Response): string {
  if (!req.session.cartGuestToken) {
    req.session.cartGuestToken = randomUUID();
  }
  const cookieDomain = resolveCookieDomain();
  // Mirror to cookie for resilience across session resets / portal hosts
  res.cookie("npc_cart_token", req.session.cartGuestToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return req.session.cartGuestToken;
}

function parseCookieToken(req: Request): string | null {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)npc_cart_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function resolveCart(req: SessionReq, res: Response) {
  const userId = req.session?.user?.id || null;
  let guestToken =
    req.session.cartGuestToken || parseCookieToken(req) || null;

  if (!userId && !guestToken) {
    guestToken = ensureGuestToken(req, res);
  } else if (!userId && guestToken) {
    req.session.cartGuestToken = guestToken;
    ensureGuestToken(req, res);
  }

  if (userId && guestToken) {
    try {
      await mergeGuestCartIntoUser(guestToken, userId);
    } catch {
      // ignore merge errors
    }
  }

  const cart = await getOrCreateCart({
    userId,
    guestToken: userId ? null : guestToken,
  });
  return cart;
}

const courseBodySchema = z.object({
  title: z.string().min(1),
  level: z.string().min(1).default("N5"),
  description: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  portal: z.enum(["group", "huongnghiep", "dichvu", "luyenthi"]).optional(),
});

const classSessionBodySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().datetime().nullable().optional().or(z.string().nullable().optional()),
  endDate: z.string().datetime().nullable().optional().or(z.string().nullable().optional()),
  scheduleText: z.string().nullable().optional(),
  locationNote: z.string().nullable().optional(),
  priceVnd: z.number().int().min(0),
  capacity: z.number().int().min(1).default(10),
  status: z.enum(["draft", "published", "full", "closed"]).optional(),
  portal: z.enum(["group", "huongnghiep", "dichvu", "luyenthi"]).optional(),
});

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Họ tên quá ngắn"),
  phone: z.string().regex(/^[0-9]{10,11}$/, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email không hợp lệ"),
  note: z.string().max(500).optional(),
});

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function registerCommerceRoutes(app: Express) {
  // -------- Public catalog --------
  app.get("/api/courses", async (req, res) => {
    try {
      const allPortals = req.query.all === "1";
      const items = await listCourses({
        publishedOnly: true,
        portal: allPortals ? undefined : req.portal,
      });
      res.json(items);
    } catch (error) {
      console.error("list courses:", error);
      res.status(500).json({ message: "Không tải được khóa học" });
    }
  });

  app.get("/api/class-sessions", async (req, res) => {
    try {
      const courseId =
        typeof req.query.courseId === "string" ? req.query.courseId : undefined;
      const allPortals = req.query.all === "1";
      const items = await listClassSessions({
        courseId,
        publicOnly: true,
        portal: allPortals ? undefined : req.portal,
      });
      res.json(items);
    } catch (error) {
      console.error("list class sessions:", error);
      res.status(500).json({ message: "Không tải được lớp học" });
    }
  });

  app.get("/api/class-sessions/:id", async (req, res) => {
    try {
      const session = await getClassSession(req.params.id);
      if (!session || session.status === "draft") {
        return res.status(404).json({ message: "Không tìm thấy lớp học" });
      }
      res.json(session);
    } catch (error) {
      console.error("get class session:", error);
      res.status(500).json({ message: "Không tải được lớp học" });
    }
  });

  // -------- Admin courses --------
  app.get("/api/admin/courses", requireAdminOrManager, async (req, res) => {
    try {
      const allPortals = req.query.all === "1";
      const portal =
        !allPortals && isPortalId(req.query.portal)
          ? req.query.portal
          : undefined;
      const allowed = sessionAllowedPortals((req as any).user);
      if (allowed && portal && !canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }
      let courses = await listCourses({ portal });
      if (allowed && allPortals) {
        courses = courses.filter((c) => canAccessPortal(allowed, c.portal));
      }
      res.json(courses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Lỗi tải khóa học" });
    }
  });

  app.post("/api/admin/courses", requireAdminOrManager, async (req, res) => {
    try {
      const body = courseBodySchema.parse(req.body);
      const portal = body.portal || req.portal || "luyenthi";
      if (!canAccessPortal(sessionAllowedPortals((req as any).user), portal)) {
        return denyPortalAccess(res);
      }
      const created = await createCourse({
        ...body,
        portal,
      });
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: error.errors?.[0]?.message || "Dữ liệu không hợp lệ" });
      }
      console.error(error);
      res.status(500).json({ message: "Không tạo được khóa học" });
    }
  });

  app.put("/api/admin/courses/:id", requireAdminOrManager, async (req, res) => {
    try {
      const body = courseBodySchema.partial().parse(req.body);
      const updated = await updateCourse(req.params.id, body);
      if (!updated) return res.status(404).json({ message: "Không tìm thấy" });
      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
      }
      console.error(error);
      res.status(500).json({ message: "Không cập nhật được khóa học" });
    }
  });

  app.delete("/api/admin/courses/:id", requireAdminOrManager, async (req, res) => {
    try {
      const ok = await deleteCourse(req.params.id);
      if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Không xóa được khóa học" });
    }
  });

  // -------- Admin class sessions --------
  app.get("/api/admin/class-sessions", requireAdminOrManager, async (req, res) => {
    try {
      const courseId =
        typeof req.query.courseId === "string" ? req.query.courseId : undefined;
      const allPortals = req.query.all === "1";
      const portal =
        !allPortals && isPortalId(req.query.portal)
          ? req.query.portal
          : undefined;
      const allowed = sessionAllowedPortals((req as any).user);
      if (allowed && portal && !canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }
      let sessions = await listClassSessions({ courseId, portal });
      if (allowed && allPortals) {
        sessions = sessions.filter((s) => canAccessPortal(allowed, s.portal));
      }
      res.json(sessions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Lỗi tải lớp học" });
    }
  });

  app.post("/api/admin/class-sessions", requireAdminOrManager, async (req, res) => {
    try {
      const body = classSessionBodySchema.parse(req.body);
      const portal = body.portal || req.portal || "luyenthi";
      if (!canAccessPortal(sessionAllowedPortals((req as any).user), portal)) {
        return denyPortalAccess(res);
      }
      const created = await createClassSession({
        ...body,
        portal,
        startDate: parseDate(body.startDate) as any,
        endDate: parseDate(body.endDate) as any,
      });
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: error.errors?.[0]?.message || "Dữ liệu không hợp lệ" });
      }
      console.error(error);
      res.status(500).json({ message: "Không tạo được lớp học" });
    }
  });

  app.put("/api/admin/class-sessions/:id", requireAdminOrManager, async (req, res) => {
    try {
      const body = classSessionBodySchema.partial().parse(req.body);
      const patch: any = { ...body };
      if ("startDate" in body) patch.startDate = parseDate(body.startDate);
      if ("endDate" in body) patch.endDate = parseDate(body.endDate);
      const updated = await updateClassSession(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Không tìm thấy" });
      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
      }
      console.error(error);
      res.status(500).json({ message: "Không cập nhật được lớp học" });
    }
  });

  app.delete("/api/admin/class-sessions/:id", requireAdminOrManager, async (req, res) => {
    try {
      const ok = await deleteClassSession(req.params.id);
      if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Không xóa được lớp học" });
    }
  });

  app.get(
    "/api/admin/class-sessions/:id/enrollments",
    requireAdminOrManager,
    async (req, res) => {
      try {
        res.json(await listEnrollmentsByClass(req.params.id));
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi tải danh sách ghi danh" });
      }
    },
  );

  app.get("/api/admin/orders", requireAdminOrManager, async (req, res) => {
    try {
      await expireStalePendingOrders();
      const status =
        typeof req.query.status === "string" && req.query.status !== "all"
          ? req.query.status
          : undefined;
      const allPortals = req.query.all === "1";
      const portal =
        !allPortals && isPortalId(req.query.portal)
          ? req.query.portal
          : undefined;
      const allowed = sessionAllowedPortals((req as any).user);
      if (allowed && portal && !canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }
      const limit = Math.min(200, parseInt(String(req.query.limit || "50"), 10) || 50);
      const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);
      const result = await listOrders({ status, limit, offset, portal });
      if (allowed && allPortals) {
        const items = result.items.filter((o) => canAccessPortal(allowed, o.portal));
        return res.json({ items, total: items.length });
      }
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Lỗi tải đơn hàng" });
    }
  });

  app.get("/api/admin/orders/stats", requireAdminOrManager, async (req, res) => {
    try {
      await expireStalePendingOrders();
      const fromStr =
        typeof req.query.from === "string" && req.query.from.trim()
          ? req.query.from.trim()
          : undefined;
      const toStr =
        typeof req.query.to === "string" && req.query.to.trim()
          ? req.query.to.trim()
          : undefined;

      let from: Date | undefined;
      let to: Date | undefined;
      if (fromStr) {
        from = new Date(fromStr);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ message: "from không hợp lệ" });
        }
        from.setHours(0, 0, 0, 0);
      }
      if (toStr) {
        to = new Date(toStr);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ message: "to không hợp lệ" });
        }
        to.setHours(23, 59, 59, 999);
      }

      const allPortals = req.query.all === "1";
      let portal =
        !allPortals && isPortalId(req.query.portal)
          ? req.query.portal
          : undefined;
      const allowed = sessionAllowedPortals((req as any).user);
      if (allowed) {
        if (portal && !canAccessPortal(allowed, portal)) {
          return denyPortalAccess(res);
        }
        if (!portal) {
          portal = allowed[0];
        }
      }

      res.json(await getOrderStats({ from, to, portal }));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Lỗi tải thống kê đơn hàng" });
    }
  });

  // -------- Cart --------
  app.get("/api/cart", async (req, res) => {
    try {
      const cart = await resolveCart(req as SessionReq, res);
      const full = await getCartWithItems(cart.id);
      res.json(full || { ...cart, items: [], totalVnd: 0 });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Không tải được giỏ hàng" });
    }
  });

  app.post("/api/cart/items", async (req, res) => {
    try {
      const classSessionId =
        typeof req.body?.classSessionId === "string"
          ? req.body.classSessionId.trim()
          : "";
      const packageId =
        typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";

      if (!classSessionId && !packageId) {
        return res
          .status(400)
          .json({ message: "Thiếu classSessionId hoặc packageId" });
      }
      if (classSessionId && packageId) {
        return res.status(400).json({
          message: "Chỉ thêm một loại mục mỗi lần (lớp hoặc gói đề)",
        });
      }

      const cart = await resolveCart(req as SessionReq, res);
      if (packageId) {
        await addCartExamPackage(cart.id, packageId);
      } else {
        await addCartItem(cart.id, classSessionId);
      }
      const full = await getCartWithItems(cart.id);
      res.status(201).json(full);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ message: error?.message || "Không thêm được vào giỏ" });
    }
  });

  app.delete("/api/cart/items/:id", async (req, res) => {
    try {
      const cart = await resolveCart(req as SessionReq, res);
      await removeCartItem(cart.id, req.params.id);
      const full = await getCartWithItems(cart.id);
      res.json(full || { ...cart, items: [], totalVnd: 0 });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Không xóa được mục giỏ hàng" });
    }
  });

  // -------- Checkout + PayOS --------
  app.post("/api/checkout", async (req, res) => {
    try {
      await expireStalePendingOrders();
      const body = checkoutSchema.parse(req.body);
      const sessionUser = (req as SessionReq).session?.user;
      const cart = await resolveCart(req as SessionReq, res);
      const cartFull = await getCartWithItems(cart.id);
      if (cartFull?.hasExamPackages && !sessionUser?.id) {
        return res.status(401).json({
          message: "Cần đăng nhập để thanh toán gói đề trong giỏ hàng",
        });
      }

      const { order, items } = await createPendingOrder({
        cartId: cart.id,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        note: body.note,
        userId: sessionUser?.id || null,
      });

      const baseUrl = resolvePublicBaseUrl({
        host: req.get("x-forwarded-host") || req.get("host"),
        forwardedProto: req.get("x-forwarded-proto"),
        protocol: req.protocol,
        portal: req.portal || order.portal,
      });
      const returnUrl = process.env.PAYOS_RETURN_URL
        ? buildPayosReturnUrl(process.env.PAYOS_RETURN_URL, order.code)
        : `${baseUrl}/checkout/success?order=${encodeURIComponent(order.code)}`;
      const cancelUrl = process.env.PAYOS_CANCEL_URL
        ? buildPayosCancelUrl(process.env.PAYOS_CANCEL_URL, order.code)
        : `${baseUrl}/checkout/cancel?order=${encodeURIComponent(order.code)}`;

      if (!isPayosConfigured()) {
        // Dev fallback: expose pending order without redirect when PayOS missing
        return res.status(201).json({
          order,
          items,
          checkoutUrl: null,
          payosConfigured: false,
          message:
            "Đơn đã tạo nhưng PayOS chưa cấu hình. Thêm PAYOS_* vào môi trường để thanh toán online.",
        });
      }

      const payment = await createPayosPaymentLink({
        orderCode: order.payosOrderCode,
        amount: order.totalVnd,
        description: `Don ${order.code}`.slice(0, 25),
        returnUrl,
        cancelUrl,
        buyerName: order.fullName,
        buyerEmail: order.email,
        buyerPhone: order.phone,
        items: items.map((i) => ({
          name: i.title.slice(0, 50),
          quantity: 1,
          price: i.priceVnd,
        })),
      });

      await updateOrderPayment(order.id, {
        paymentLinkId: payment.paymentLinkId,
        checkoutUrl: payment.checkoutUrl,
      });

      res.status(201).json({
        order: { ...order, checkoutUrl: payment.checkoutUrl, paymentLinkId: payment.paymentLinkId },
        items,
        checkoutUrl: payment.checkoutUrl,
        payosConfigured: true,
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: error.errors?.[0]?.message || "Dữ liệu không hợp lệ" });
      }
      console.error("checkout error:", error);
      res.status(400).json({ message: error?.message || "Không tạo được đơn hàng" });
    }
  });

  app.post("/api/webhooks/payos", async (req, res) => {
    try {
      const verified = await verifyPayosWebhook(req.body);
      if (!verified.ok || !verified.orderCode) {
        return res.json({ success: false });
      }

      const order = await getOrderByPayosCode(verified.orderCode);
      if (order) {
        if (order.status === "paid") {
          return res.json({ success: true });
        }
        await markOrderPaid(order.id);
        return res.json({ success: true });
      }

      const examOrder = await getExamPackageOrderByPayosCode(verified.orderCode);
      if (examOrder) {
        if (examOrder.status === "paid") {
          return res.json({ success: true });
        }
        await fulfillExamPackageOrder(examOrder.id);
        return res.json({ success: true });
      }

      return res.json({ success: false });
    } catch (error) {
      console.error("PayOS webhook error:", error);
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/orders/:code", async (req, res) => {
    try {
      const order = await getOrderByCode(req.params.code);
      if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });

      const email =
        typeof req.query.email === "string"
          ? req.query.email.trim().toLowerCase()
          : "";
      const phone =
        typeof req.query.phone === "string" ? req.query.phone.trim() : "";
      const sessionUser = (req as SessionReq).session?.user;
      const isAdmin =
        sessionUser &&
        (sessionUser.role === "admin" || sessionUser.role === "manager");
      const isOwner =
        (sessionUser && order.userId && sessionUser.id === order.userId) ||
        (email && email === order.email) ||
        (phone && phone === order.phone);

      if (!isAdmin && !isOwner) {
        // Allow polling success page with only order code briefly (code is unguessable)
        // Still hide contact PII if no match — return status-only
        return res.json({
          code: order.code,
          status: order.status,
          totalVnd: order.totalVnd,
          items: order.items.map((i) => ({
            title: i.title,
            priceVnd: i.priceVnd,
            scheduleText: i.scheduleText,
            itemType: i.itemType,
          })),
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        });
      }

      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Lỗi tải đơn hàng" });
    }
  });

  app.post("/api/orders/:code/cancel", async (req, res) => {
    try {
      const order = await getOrderByCode(req.params.code);
      if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });
      const updated = await cancelPendingOrder(order.id);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Không hủy được đơn" });
    }
  });
}
