import { and, eq, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";
import {
  examLevelEntitlements,
  examPackageOrders,
  examPackages,
  type ExamPackageOrder,
} from "@shared/schema";
import {
  activateEntitlementForPackage,
  getExamPackage,
  listActivePackageIdsForUser,
} from "./examEntitlements";
import { generateUniquePayosOrderCode } from "./payosOrderCode";

const ORDER_TTL_MS = 30 * 60 * 1000;

function generateOrderCode(): string {
  const n = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EP-${n}-${r}`;
}

export async function expireStaleExamPackageOrders(): Promise<number> {
  const now = new Date();
  const stale = await db
    .select()
    .from(examPackageOrders)
    .where(
      and(
        eq(examPackageOrders.status, "pending"),
        lt(examPackageOrders.expiresAt, now),
      ),
    );

  for (const order of stale) {
    await db
      .update(examPackageOrders)
      .set({ status: "expired", updatedAt: now })
      .where(eq(examPackageOrders.id, order.id));
  }
  return stale.length;
}

async function assertCanPurchasePackage(
  userId: string,
  packageId: string,
): Promise<void> {
  const activeIds = await listActivePackageIdsForUser(userId);
  if (activeIds.includes(packageId)) {
    throw new Error("Bạn đã có quyền gói đề này");
  }

  const [pendingEnt] = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, userId),
        eq(examLevelEntitlements.packageId, packageId),
        eq(examLevelEntitlements.status, "pending"),
      ),
    )
    .limit(1);
  if (pendingEnt) {
    throw new Error("Gói đề đang chờ duyệt thanh toán thủ công");
  }

  const [pendingOrder] = await db
    .select()
    .from(examPackageOrders)
    .where(
      and(
        eq(examPackageOrders.userId, userId),
        eq(examPackageOrders.packageId, packageId),
        eq(examPackageOrders.status, "pending"),
      ),
    )
    .limit(1);
  if (pendingOrder) {
    throw new Error("Bạn đã có đơn PayOS đang chờ thanh toán cho gói này");
  }
}

export async function createExamPackageOrder(input: {
  userId: string;
  packageId: string;
}): Promise<{
  order: ExamPackageOrder;
  pkg: NonNullable<Awaited<ReturnType<typeof getExamPackage>>>;
}> {
  await expireStaleExamPackageOrders();

  const pkg = await getExamPackage(input.packageId);
  if (!pkg || !pkg.isActive) {
    throw new Error("Gói đề không tồn tại hoặc đã tắt");
  }
  if (pkg.priceVnd <= 0) {
    throw new Error("Gói đề miễn phí — không cần thanh toán");
  }

  await assertCanPurchasePackage(input.userId, pkg.id);

  const payosOrderCode = await generateUniquePayosOrderCode();

  const [order] = await db
    .insert(examPackageOrders)
    .values({
      id: randomUUID(),
      code: generateOrderCode(),
      payosOrderCode,
      userId: input.userId,
      packageId: pkg.id,
      amountVnd: pkg.priceVnd,
      status: "pending",
      expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    })
    .returning();

  return { order, pkg };
}

export async function updateExamPackageOrderPayment(
  orderId: string,
  data: {
    paymentLinkId?: string;
    checkoutUrl?: string;
    entitlementId?: string;
  },
): Promise<ExamPackageOrder | null> {
  const [row] = await db
    .update(examPackageOrders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(examPackageOrders.id, orderId))
    .returning();
  return row ?? null;
}

export async function getExamPackageOrderByPayosCode(
  payosOrderCode: number,
): Promise<ExamPackageOrder | undefined> {
  const [row] = await db
    .select()
    .from(examPackageOrders)
    .where(eq(examPackageOrders.payosOrderCode, payosOrderCode))
    .limit(1);
  return row;
}

export async function getExamPackageOrderByCode(
  code: string,
): Promise<ExamPackageOrder | undefined> {
  const [row] = await db
    .select()
    .from(examPackageOrders)
    .where(eq(examPackageOrders.code, code))
    .limit(1);
  return row;
}

export async function cancelExamPackageOrder(
  orderId: string,
): Promise<ExamPackageOrder | null> {
  const [order] = await db
    .select()
    .from(examPackageOrders)
    .where(eq(examPackageOrders.id, orderId))
    .limit(1);
  if (!order || order.status !== "pending") return order ?? null;

  const [updated] = await db
    .update(examPackageOrders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(examPackageOrders.id, orderId))
    .returning();
  return updated ?? null;
}

export async function fulfillExamPackageOrder(
  orderId: string,
): Promise<ExamPackageOrder | null> {
  const [order] = await db
    .select()
    .from(examPackageOrders)
    .where(eq(examPackageOrders.id, orderId))
    .limit(1);
  if (!order) return null;
  if (order.status === "paid") return order;

  const ent = await activateEntitlementForPackage({
    userId: order.userId,
    packageId: order.packageId,
    reviewedBy: "payos",
    note: `PayOS ${order.code}`,
  });

  const [updated] = await db
    .update(examPackageOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      entitlementId: ent.id,
      updatedAt: new Date(),
    })
    .where(eq(examPackageOrders.id, orderId))
    .returning();

  return updated ?? null;
}

export async function getExamPackageOrderWithPackage(code: string) {
  const order = await getExamPackageOrderByCode(code);
  if (!order) return undefined;
  const [pkg] = await db
    .select()
    .from(examPackages)
    .where(eq(examPackages.id, order.packageId))
    .limit(1);
  return { order, package: pkg };
}
