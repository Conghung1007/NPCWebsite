import { eq } from "drizzle-orm";
import { db } from "./db";
import { examPackageOrders, orders } from "@shared/schema";

function randomPayosOrderCode(): number {
  return (
    Math.floor(Date.now() % 1_000_000_000) * 100 +
    Math.floor(Math.random() * 100)
  );
}

/** PayOS orderCode unique across commerce `orders` and `exam_package_orders`. */
export async function generateUniquePayosOrderCode(): Promise<number> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomPayosOrderCode();
    const [commerce] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.payosOrderCode, code))
      .limit(1);
    if (commerce) continue;

    const [exam] = await db
      .select({ id: examPackageOrders.id })
      .from(examPackageOrders)
      .where(eq(examPackageOrders.payosOrderCode, code))
      .limit(1);
    if (exam) continue;

    return code;
  }
  throw new Error("Không tạo được mã PayOS duy nhất");
}

function withOrderQuery(
  baseUrl: string,
  orderCode: string,
  type?: "exam-package" | "class",
): string {
  const isAbsolute = /^https?:\/\//i.test(baseUrl);
  const url = isAbsolute
    ? new URL(baseUrl)
    : new URL(baseUrl, "http://localhost");
  url.searchParams.set("order", orderCode);
  if (type === "exam-package") {
    url.searchParams.set("type", "exam-package");
  }
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
}

export function buildPayosReturnUrl(
  baseReturnUrl: string,
  orderCode: string,
  type?: "exam-package" | "class",
): string {
  return withOrderQuery(baseReturnUrl, orderCode, type);
}

export function buildPayosCancelUrl(
  baseCancelUrl: string,
  orderCode: string,
  type?: "exam-package" | "class",
): string {
  return withOrderQuery(baseCancelUrl, orderCode, type);
}
