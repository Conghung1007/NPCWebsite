import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  carts,
  cartItems,
  classSessions,
  courses,
  enrollments,
  examPackages,
  orderItems,
  orders,
  type Cart,
  type CartItem,
  type ClassSession,
  type Course,
  type Enrollment,
  type ExamPackage,
  type InsertClassSession,
  type InsertCourse,
  type Order,
  type OrderItem,
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  activateEntitlementForPackage,
  countExamsInPackage,
  getExamPackage,
  listActivePackageIdsForUser,
  resolveDisplayExamCount,
} from "./examEntitlements";
import { generateUniquePayosOrderCode } from "./payosOrderCode";

const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ORDER_PENDING_TTL_MS = 30 * 60 * 1000;

export function seatsAvailable(session: ClassSession): number {
  return Math.max(
    0,
    session.capacity - session.enrolledCount - session.reservedCount,
  );
}

export function isSessionSellable(session: ClassSession): boolean {
  return (
    session.status === "published" &&
    seatsAvailable(session) > 0
  );
}

// --- Courses ---

export async function listCourses(opts?: {
  publishedOnly?: boolean;
  portal?: string;
}): Promise<Course[]> {
  const conditions = [];
  if (opts?.publishedOnly) conditions.push(eq(courses.isPublished, true));
  if (opts?.portal) conditions.push(eq(courses.portal, opts.portal));

  if (conditions.length) {
    return db
      .select()
      .from(courses)
      .where(and(...conditions))
      .orderBy(asc(courses.sortOrder), desc(courses.createdAt));
  }
  return db
    .select()
    .from(courses)
    .orderBy(asc(courses.sortOrder), desc(courses.createdAt));
}

export async function getCourse(id: string): Promise<Course | undefined> {
  const [row] = await db.select().from(courses).where(eq(courses.id, id));
  return row;
}

export async function createCourse(
  data: InsertCourse,
): Promise<Course> {
  const [row] = await db
    .insert(courses)
    .values({
      title: data.title,
      level: data.level ?? "N5",
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      isPublished: data.isPublished ?? false,
      sortOrder: data.sortOrder ?? 0,
      portal: data.portal ?? "luyenthi",
    })
    .returning();
  return row;
}

export async function updateCourse(
  id: string,
  data: Partial<InsertCourse>,
): Promise<Course | null> {
  const [row] = await db
    .update(courses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCourse(id: string): Promise<boolean> {
  const sessions = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(eq(classSessions.courseId, id));
  for (const s of sessions) {
    await deleteClassSession(s.id);
  }
  const deleted = await db.delete(courses).where(eq(courses.id, id)).returning();
  return deleted.length > 0;
}

// --- Class sessions ---

export async function listClassSessions(opts?: {
  courseId?: string;
  status?: string;
  publicOnly?: boolean;
  portal?: string;
}): Promise<(ClassSession & { courseTitle?: string; courseLevel?: string })[]> {
  const rows = await db
    .select({
      session: classSessions,
      courseTitle: courses.title,
      courseLevel: courses.level,
    })
    .from(classSessions)
    .leftJoin(courses, eq(classSessions.courseId, courses.id))
    .orderBy(desc(classSessions.startDate), desc(classSessions.createdAt));

  let filtered = rows;
  if (opts?.portal) {
    filtered = filtered.filter((r) => r.session.portal === opts.portal);
  }
  if (opts?.courseId) {
    filtered = filtered.filter((r) => r.session.courseId === opts.courseId);
  }
  if (opts?.status) {
    filtered = filtered.filter((r) => r.session.status === opts.status);
  }
  if (opts?.publicOnly) {
    filtered = filtered.filter(
      (r) =>
        r.session.status === "published" &&
        (r.courseTitle == null || true) &&
        seatsAvailable(r.session) >= 0,
    );
    // Only published courses' sessions on public catalog
    filtered = filtered.filter((r) => {
      // re-check course published via join — need course.isPublished
      return true;
    });
  }

  if (opts?.publicOnly) {
    const publishedCourses = await listCourses({ publishedOnly: true });
    const pubIds = new Set(publishedCourses.map((c) => c.id));
    filtered = filtered.filter(
      (r) =>
        r.session.status === "published" &&
        pubIds.has(r.session.courseId) &&
        seatsAvailable(r.session) > 0,
    );
  }

  return filtered.map((r) => ({
    ...r.session,
    courseTitle: r.courseTitle ?? undefined,
    courseLevel: r.courseLevel ?? undefined,
  }));
}

export async function getClassSession(
  id: string,
): Promise<(ClassSession & { courseTitle?: string; courseLevel?: string; courseDescription?: string | null }) | undefined> {
  const [row] = await db
    .select({
      session: classSessions,
      courseTitle: courses.title,
      courseLevel: courses.level,
      courseDescription: courses.description,
      coursePublished: courses.isPublished,
    })
    .from(classSessions)
    .leftJoin(courses, eq(classSessions.courseId, courses.id))
    .where(eq(classSessions.id, id));
  if (!row) return undefined;
  return {
    ...row.session,
    courseTitle: row.courseTitle ?? undefined,
    courseLevel: row.courseLevel ?? undefined,
    courseDescription: row.courseDescription,
  };
}

export async function createClassSession(
  data: InsertClassSession,
): Promise<ClassSession> {
  const [row] = await db
    .insert(classSessions)
    .values({
      courseId: data.courseId,
      title: data.title,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      scheduleText: data.scheduleText ?? null,
      locationNote: data.locationNote ?? null,
      priceVnd: data.priceVnd ?? 0,
      capacity: data.capacity ?? 10,
      status: data.status ?? "draft",
      portal: data.portal ?? "luyenthi",
    })
    .returning();
  return row;
}

export async function updateClassSession(
  id: string,
  data: Partial<InsertClassSession> & {
    enrolledCount?: number;
    reservedCount?: number;
  },
): Promise<ClassSession | null> {
  const [row] = await db
    .update(classSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(classSessions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteClassSession(id: string): Promise<boolean> {
  await db.delete(cartItems).where(eq(cartItems.classSessionId, id));
  const deleted = await db
    .delete(classSessions)
    .where(eq(classSessions.id, id))
    .returning();
  return deleted.length > 0;
}

async function refreshSessionFullStatus(sessionId: string): Promise<void> {
  const session = await getClassSession(sessionId);
  if (!session) return;
  if (session.status === "closed" || session.status === "draft") return;
  const available = seatsAvailable(session);
  if (available <= 0 && session.status === "published") {
    await updateClassSession(sessionId, { status: "full" });
  } else if (available > 0 && session.status === "full") {
    await updateClassSession(sessionId, { status: "published" });
  }
}

// --- Cart ---

export type CartClassItem = CartItem & {
  itemType: "class";
  classSession: ClassSession & {
    courseTitle?: string;
    courseLevel?: string;
  };
};

export type CartExamPackageItem = CartItem & {
  itemType: "exam_package";
  examPackage: ExamPackage;
};

export type CartLineItem = CartClassItem | CartExamPackageItem;

export type CartWithItems = Cart & {
  items: CartLineItem[];
  totalVnd: number;
  hasExamPackages: boolean;
  hasClasses: boolean;
};

export async function getOrCreateCart(opts: {
  guestToken?: string | null;
  userId?: string | null;
}): Promise<Cart> {
  const now = new Date();
  if (opts.userId) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.userId, opts.userId), gt(carts.expiresAt, now)));
    if (existing) {
      await db
        .update(carts)
        .set({ expiresAt: new Date(Date.now() + CART_TTL_MS), updatedAt: now })
        .where(eq(carts.id, existing.id));
      return { ...existing, expiresAt: new Date(Date.now() + CART_TTL_MS) };
    }
  }
  if (opts.guestToken) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.guestToken, opts.guestToken), gt(carts.expiresAt, now)));
    if (existing) {
      await db
        .update(carts)
        .set({
          userId: opts.userId || existing.userId,
          expiresAt: new Date(Date.now() + CART_TTL_MS),
          updatedAt: now,
        })
        .where(eq(carts.id, existing.id));
      return {
        ...existing,
        userId: opts.userId || existing.userId,
        expiresAt: new Date(Date.now() + CART_TTL_MS),
      };
    }
  }

  const guestToken = opts.guestToken || randomUUID();
  const [created] = await db
    .insert(carts)
    .values({
      guestToken: opts.userId ? null : guestToken,
      userId: opts.userId || null,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    })
    .returning();
  return created;
}

export async function mergeGuestCartIntoUser(
  guestToken: string,
  userId: string,
): Promise<void> {
  const guestCart = await getOrCreateCart({ guestToken });
  const userCart = await getOrCreateCart({ userId });
  if (guestCart.id === userCart.id) return;

  const guestItems = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, guestCart.id));
  for (const item of guestItems) {
    if (item.itemType === "exam_package" && item.packageId) {
      const [dup] = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, userCart.id),
            eq(cartItems.packageId, item.packageId),
          ),
        );
      if (!dup) {
        await db.insert(cartItems).values({
          cartId: userCart.id,
          itemType: "exam_package",
          packageId: item.packageId,
        });
      }
      continue;
    }
    if (!item.classSessionId) continue;
    const [dup] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, userCart.id),
          eq(cartItems.classSessionId, item.classSessionId),
        ),
      );
    if (!dup) {
      await db.insert(cartItems).values({
        cartId: userCart.id,
        itemType: "class",
        classSessionId: item.classSessionId,
      });
    }
  }
  await db.delete(cartItems).where(eq(cartItems.cartId, guestCart.id));
  await db.delete(carts).where(eq(carts.id, guestCart.id));
}

export async function getCartWithItems(cartId: string): Promise<CartWithItems | null> {
  const [cart] = await db.select().from(carts).where(eq(carts.id, cartId));
  if (!cart) return null;

  const classRows = await db
    .select({
      item: cartItems,
      session: classSessions,
      courseTitle: courses.title,
      courseLevel: courses.level,
    })
    .from(cartItems)
    .innerJoin(classSessions, eq(cartItems.classSessionId, classSessions.id))
    .leftJoin(courses, eq(classSessions.courseId, courses.id))
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.itemType, "class")));

  const packageRows = await db
    .select({
      item: cartItems,
      pkg: examPackages,
    })
    .from(cartItems)
    .innerJoin(examPackages, eq(cartItems.packageId, examPackages.id))
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.itemType, "exam_package")),
    );

  const packageItems = await Promise.all(
    packageRows.map(async (r) => {
      const linkedExamCount = await countExamsInPackage(r.pkg.id);
      return {
        ...r.item,
        itemType: "exam_package" as const,
        examPackage: {
          ...r.pkg,
          linkedExamCount,
          displayExamCount: resolveDisplayExamCount(
            r.pkg.examCount,
            linkedExamCount,
          ),
        },
      };
    }),
  );

  const mapped: CartLineItem[] = [
    ...classRows.map((r) => ({
      ...r.item,
      itemType: "class" as const,
      classSession: {
        ...r.session,
        courseTitle: r.courseTitle ?? undefined,
        courseLevel: r.courseLevel ?? undefined,
      },
    })),
    ...packageItems,
  ];

  const totalVnd = mapped.reduce((sum, i) => {
    if (i.itemType === "class") {
      return sum + (Number(i.classSession.priceVnd) || 0);
    }
    return sum + (Number(i.examPackage.priceVnd) || 0);
  }, 0);

  return {
    ...cart,
    items: mapped,
    totalVnd,
    hasExamPackages: mapped.some((i) => i.itemType === "exam_package"),
    hasClasses: mapped.some((i) => i.itemType === "class"),
  };
}

export async function addCartItem(
  cartId: string,
  classSessionId: string,
): Promise<CartItem> {
  const session = await getClassSession(classSessionId);
  if (!session || !isSessionSellable(session)) {
    throw new Error("Lớp học không còn mở đăng ký hoặc đã hết chỗ");
  }

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.classSessionId, classSessionId),
      ),
    );
  if (existing) return existing;

  const [created] = await db
    .insert(cartItems)
    .values({ cartId, itemType: "class", classSessionId })
    .returning();
  return created;
}

export async function addCartExamPackage(
  cartId: string,
  packageId: string,
): Promise<CartItem> {
  const pkg = await getExamPackage(packageId);
  if (!pkg || !pkg.isActive) {
    throw new Error("Gói đề không tồn tại hoặc đã tắt");
  }
  if (pkg.priceVnd <= 0) {
    throw new Error("Gói miễn phí — không cần thêm vào giỏ");
  }

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.packageId, packageId),
      ),
    );
  if (existing) return existing;

  const [created] = await db
    .insert(cartItems)
    .values({ cartId, itemType: "exam_package", packageId })
    .returning();
  return created;
}

export async function removeCartItem(
  cartId: string,
  itemId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning();
  return deleted.length > 0;
}

export async function clearCart(cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

// --- Orders ---

function generateOrderCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NPC-${stamp}-${rand}`;
}

export async function expireStalePendingOrders(): Promise<number> {
  const now = new Date();
  const stale = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.expiresAt, now)));

  for (const order of stale) {
    await releaseOrderReservations(order.id);
    await db
      .update(orders)
      .set({ status: "expired", updatedAt: now })
      .where(eq(orders.id, order.id));
  }
  return stale.length;
}

async function releaseOrderReservations(orderId: string): Promise<void> {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (item.itemType !== "class" || !item.classSessionId) continue;
    await db
      .update(classSessions)
      .set({
        reservedCount: sql`GREATEST(${classSessions.reservedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, item.classSessionId));
    await refreshSessionFullStatus(item.classSessionId);
  }
}

export async function reserveSeat(sessionId: string): Promise<boolean> {
  const updated = await db
    .update(classSessions)
    .set({
      reservedCount: sql`${classSessions.reservedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(classSessions.id, sessionId),
        sql`${classSessions.status} IN ('published', 'full')`,
        sql`${classSessions.enrolledCount} + ${classSessions.reservedCount} < ${classSessions.capacity}`,
      ),
    )
    .returning({ id: classSessions.id });

  if (updated.length > 0) {
    await refreshSessionFullStatus(sessionId);
    return true;
  }
  return false;
}

export type CreateCheckoutInput = {
  cartId: string;
  fullName: string;
  phone: string;
  email: string;
  note?: string;
  userId?: string | null;
};

export async function createPendingOrder(
  input: CreateCheckoutInput,
): Promise<{ order: Order; items: OrderItem[] }> {
  await expireStalePendingOrders();

  const cart = await getCartWithItems(input.cartId);
  if (!cart || cart.items.length === 0) {
    throw new Error("Giỏ hàng trống");
  }

  if (cart.hasExamPackages && !input.userId) {
    throw new Error("Cần đăng nhập để mua gói đề");
  }

  const classItems = cart.items.filter((i) => i.itemType === "class");
  const packageItems = cart.items.filter((i) => i.itemType === "exam_package");

  for (const item of classItems) {
    if (!isSessionSellable(item.classSession)) {
      throw new Error(`Lớp "${item.classSession.title}" không còn mở đăng ký`);
    }
  }

  if (input.userId && packageItems.length > 0) {
    const activeIds = await listActivePackageIdsForUser(input.userId);
    for (const item of packageItems) {
      if (activeIds.includes(item.examPackage.id)) {
        throw new Error(`Bạn đã có quyền gói "${item.examPackage.name}"`);
      }
    }
  }

  const reservedIds: string[] = [];
  try {
    for (const item of classItems) {
      const ok = await reserveSeat(item.classSession.id);
      if (!ok) {
        throw new Error(`Lớp "${item.classSession.title}" đã hết chỗ`);
      }
      reservedIds.push(item.classSession.id);
    }

    const totalVnd = cart.totalVnd;

    const orderPortal =
      classItems[0]?.classSession?.portal ||
      (packageItems.length > 0 ? "luyenthi" : "luyenthi");

    const payosOrderCode = await generateUniquePayosOrderCode();

    const [order] = await db
      .insert(orders)
      .values({
        code: generateOrderCode(),
        payosOrderCode,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        note: input.note?.trim() || null,
        userId: input.userId || null,
        totalVnd,
        status: "pending",
        portal: orderPortal,
        expiresAt: new Date(Date.now() + ORDER_PENDING_TTL_MS),
      })
      .returning();

    const items: OrderItem[] = [];
    for (const item of classItems) {
      const [oi] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          itemType: "class",
          classSessionId: item.classSessionId,
          title: item.classSession.title,
          scheduleText: item.classSession.scheduleText,
          priceVnd: item.classSession.priceVnd,
        })
        .returning();
      items.push(oi);
    }
    for (const item of packageItems) {
      const [oi] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          itemType: "exam_package",
          packageId: item.packageId,
          title: item.examPackage.name,
          scheduleText: item.examPackage.level
            ? `JLPT ${item.examPackage.level.toUpperCase()}`
            : null,
          priceVnd: item.examPackage.priceVnd,
        })
        .returning();
      items.push(oi);
    }

    await clearCart(input.cartId);
    return { order, items };
  } catch (err) {
    for (const id of reservedIds) {
      await db
        .update(classSessions)
        .set({
          reservedCount: sql`GREATEST(${classSessions.reservedCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(classSessions.id, id));
      await refreshSessionFullStatus(id);
    }
    throw err;
  }
}

export async function updateOrderPayment(
  orderId: string,
  data: {
    paymentLinkId?: string;
    checkoutUrl?: string;
    status?: string;
  },
): Promise<Order | null> {
  const [row] = await db
    .update(orders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return row ?? null;
}

export async function getOrderByCode(code: string): Promise<
  | (Order & { items: OrderItem[] })
  | undefined
> {
  const [order] = await db.select().from(orders).where(eq(orders.code, code));
  if (!order) return undefined;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return { ...order, items };
}

export async function getOrderByPayosCode(
  payosOrderCode: number,
): Promise<(Order & { items: OrderItem[] }) | undefined> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.payosOrderCode, payosOrderCode));
  if (!order) return undefined;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return { ...order, items };
}

export async function markOrderPaid(orderId: string): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  if (order.status === "paid") return order; // idempotent

  if (order.status !== "pending") {
    throw new Error(`Không thể thanh toán đơn ở trạng thái ${order.status}`);
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (item.itemType === "exam_package" && item.packageId && order.userId) {
      try {
        await activateEntitlementForPackage({
          userId: order.userId,
          packageId: item.packageId,
          reviewedBy: "payos",
          note: `Đơn ${order.code}`,
        });
      } catch {
        // entitlement may already exist — order still paid
      }
      continue;
    }
    if (item.itemType !== "class" || !item.classSessionId) continue;

    await db
      .update(classSessions)
      .set({
        reservedCount: sql`GREATEST(${classSessions.reservedCount} - 1, 0)`,
        enrolledCount: sql`${classSessions.enrolledCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, item.classSessionId));

    try {
      await db.insert(enrollments).values({
        classSessionId: item.classSessionId,
        orderId: order.id,
        userId: order.userId,
        fullName: order.fullName,
        phone: order.phone,
        email: order.email,
      });
    } catch {
      // unique phone+class — still count as paid order item
    }
    await refreshSessionFullStatus(item.classSessionId);
  }

  const [updated] = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return updated ?? null;
}

export async function cancelPendingOrder(orderId: string): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.status !== "pending") return order ?? null;
  await releaseOrderReservations(orderId);
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return updated ?? null;
}

export async function listOrders(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
  portal?: string;
}): Promise<{ items: (Order & { items: OrderItem[] })[]; total: number }> {
  const all = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));

  let filtered = all;
  if (opts?.status) {
    filtered = filtered.filter((o) => o.status === opts.status);
  }
  if (opts?.portal) {
    filtered = filtered.filter((o) => o.portal === opts.portal);
  }
  const total = filtered.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  const slice = filtered.slice(offset, offset + limit);

  const items = await Promise.all(
    slice.map(async (order) => {
      const ois = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      return { ...order, items: ois };
    }),
  );

  return { items, total };
}

export async function listEnrollmentsByClass(
  classSessionId: string,
): Promise<Enrollment[]> {
  return db
    .select()
    .from(enrollments)
    .where(eq(enrollments.classSessionId, classSessionId))
    .orderBy(desc(enrollments.createdAt));
}

export type OrderStats = {
  from: string | null;
  to: string | null;
  revenuePaidVnd: number;
  orderCounts: {
    paid: number;
    pending: number;
    cancelled: number;
    expired: number;
    failed: number;
    all: number;
  };
  last7Days: { orders: number; revenueVnd: number };
  last30Days: { orders: number; revenueVnd: number };
  conversionRate: number; // paid / (paid + cancelled + expired), 0–1
  topClasses: Array<{
    classSessionId: string;
    title: string;
    enrollmentCount: number;
    revenueVnd: number;
    paidOrderCount: number;
  }>;
  /** Paid orders in range for CSV export */
  paidOrders: Array<{
    code: string;
    fullName: string;
    phone: string;
    email: string;
    totalVnd: number;
    paidAt: string | null;
    createdAt: string;
    items: string;
  }>;
};

function inRange(date: Date | null | undefined, from?: Date, to?: Date): boolean {
  if (!date) return false;
  const t = date.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export async function getOrderStats(opts?: {
  from?: Date;
  to?: Date;
  portal?: string;
}): Promise<OrderStats> {
  let allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  if (opts?.portal) {
    allOrders = allOrders.filter((o) => o.portal === opts.portal);
  }
  const allItems = await db.select().from(orderItems);
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const from = opts?.from;
  const to = opts?.to;

  // Primary range filter uses createdAt (and paidAt for revenue when paid)
  const inPrimaryRange = (o: Order) => {
    if (!from && !to) return true;
    return inRange(o.createdAt ? new Date(o.createdAt) : null, from, to);
  };

  const ranged = allOrders.filter(inPrimaryRange);

  const orderCounts = {
    paid: 0,
    pending: 0,
    cancelled: 0,
    expired: 0,
    failed: 0,
    all: ranged.length,
  };

  let revenuePaidVnd = 0;
  for (const o of ranged) {
    if (o.status in orderCounts) {
      (orderCounts as any)[o.status] += 1;
    }
    if (o.status === "paid") {
      revenuePaidVnd += Number(o.totalVnd) || 0;
    }
  }

  const now = Date.now();
  const d7 = now - 7 * 24 * 60 * 60 * 1000;
  const d30 = now - 30 * 24 * 60 * 60 * 1000;

  const last7 = { orders: 0, revenueVnd: 0 };
  const last30 = { orders: 0, revenueVnd: 0 };
  for (const o of allOrders) {
    if (o.status !== "paid") continue;
    const ts = o.paidAt
      ? new Date(o.paidAt).getTime()
      : new Date(o.createdAt).getTime();
    if (ts >= d7) {
      last7.orders += 1;
      last7.revenueVnd += Number(o.totalVnd) || 0;
    }
    if (ts >= d30) {
      last30.orders += 1;
      last30.revenueVnd += Number(o.totalVnd) || 0;
    }
  }

  const denom =
    orderCounts.paid + orderCounts.cancelled + orderCounts.expired;
  const conversionRate = denom > 0 ? orderCounts.paid / denom : 0;

  // Top classes from paid orders in range
  const classAgg = new Map<
    string,
    { title: string; enrollmentCount: number; revenueVnd: number; paidOrderCount: number }
  >();

  for (const o of ranged) {
    if (o.status !== "paid") continue;
    const ois = itemsByOrder.get(o.id) || [];
    // Split order total evenly across items if multiple (prices are per-item)
    for (const oi of ois) {
      const cur = classAgg.get(oi.classSessionId) || {
        title: oi.title,
        enrollmentCount: 0,
        revenueVnd: 0,
        paidOrderCount: 0,
      };
      cur.enrollmentCount += 1;
      cur.revenueVnd += Number(oi.priceVnd) || 0;
      cur.paidOrderCount += 1;
      cur.title = oi.title || cur.title;
      classAgg.set(oi.classSessionId, cur);
    }
  }

  const topClasses = [...classAgg.entries()]
    .map(([classSessionId, v]) => ({ classSessionId, ...v }))
    .sort((a, b) => b.revenueVnd - a.revenueVnd || b.enrollmentCount - a.enrollmentCount)
    .slice(0, 10);

  const paidOrders = ranged
    .filter((o) => o.status === "paid")
    .map((o) => ({
      code: o.code,
      fullName: o.fullName,
      phone: o.phone,
      email: o.email,
      totalVnd: Number(o.totalVnd) || 0,
      paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
      createdAt: new Date(o.createdAt).toISOString(),
      items: (itemsByOrder.get(o.id) || []).map((i) => i.title).join("; "),
    }));

  return {
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    revenuePaidVnd,
    orderCounts,
    last7Days: last7,
    last30Days: last30,
    conversionRate,
    topClasses,
    paidOrders,
  };
}
