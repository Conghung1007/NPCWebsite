/** Display helpers for exam package catalog (storefront + cart). */

export type PackageCountFields = {
  examCount: number;
  linkedExamCount?: number;
  displayExamCount?: number;
  priceVnd: number;
  compareAtPriceVnd?: number | null;
  level?: string | null;
};

export type PackageSaleInfo = {
  onSale: boolean;
  salePriceVnd: number;
  compareAtPriceVnd: number | null;
  discountPercent: number;
};

export function getPackageSaleInfo(
  pkg: Pick<PackageCountFields, "priceVnd" | "compareAtPriceVnd">,
): PackageSaleInfo {
  const salePriceVnd = Math.max(0, Math.floor(pkg.priceVnd) || 0);
  const compareAt = pkg.compareAtPriceVnd;
  if (
    typeof compareAt === "number" &&
    compareAt > salePriceVnd &&
    salePriceVnd > 0
  ) {
    return {
      onSale: true,
      salePriceVnd,
      compareAtPriceVnd: compareAt,
      discountPercent: Math.round((1 - salePriceVnd / compareAt) * 100),
    };
  }
  return {
    onSale: false,
    salePriceVnd,
    compareAtPriceVnd: null,
    discountPercent: 0,
  };
}

export function formatVnd(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}

/** Số đề hiển thị — ưu tiên đề đã gắn; nếu chưa gắn thì dùng examCount/displayExamCount. */
export function getEffectiveExamCount(pkg: PackageCountFields): number {
  if (typeof pkg.displayExamCount === "number" && pkg.displayExamCount > 0) {
    return pkg.displayExamCount;
  }
  const declared = Math.max(0, Number(pkg.examCount) || 0);
  const linked = pkg.linkedExamCount;
  if (typeof linked === "number" && linked > 0) return linked;
  return declared;
}

export function formatExamCountShort(count: number): string {
  if (count <= 0) return "Đang cập nhật đề";
  if (count === 1) return "1 đề thi";
  return `${count} đề thi`;
}

export function formatPricePerExam(priceVnd: number, count: number): string | null {
  if (count <= 0 || priceVnd <= 0) return null;
  const per = Math.round(priceVnd / count);
  return `≈ ${per.toLocaleString("vi-VN")}đ/đề`;
}

export function buildPackageCardBullets(
  pkg: PackageCountFields & { description?: string | null },
  opts: { active: boolean; pending: boolean },
): string[] {
  const count = getEffectiveExamCount(pkg);
  const lines: string[] = [];

  lines.push(formatExamCountShort(count));

  if (pkg.level) {
    lines.push(`Luyện thi JLPT ${pkg.level.toUpperCase()}`);
  }

  if (opts.active) {
    lines.push("Đã mở — thi không giới hạn lượt");
  } else if (opts.pending) {
    lines.push("Đang chờ xác nhận thanh toán");
  } else if (count <= 0) {
    lines.push("Admin đang bổ sung đề vào gói");
  }

  return lines;
}

export function packageLevelBanner(pkg: { level?: string | null; name: string }): {
  subtitle: string;
  title: string;
} {
  if (pkg.level) {
    return { subtitle: "JLPT", title: pkg.level.toUpperCase() };
  }
  const match = pkg.name.match(/\b(N[1-5])\b/i);
  if (match) {
    return { subtitle: "JLPT", title: match[1].toUpperCase() };
  }
  return { subtitle: "Gói đề", title: "TNJS" };
}
