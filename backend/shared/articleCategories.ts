/**
 * Article categories used by CMS `articles` blocks and Cpanel.
 * Listing = filter by category + request portal (X-Portal).
 */

export type ArticlePortalId =
  | "group"
  | "huongnghiep"
  | "dichvu"
  | "luyenthi";

export const ARTICLE_CATEGORIES = [
  {
    value: "study-abroad",
    label: "Du học / Hướng nghiệp",
    portal: "huongnghiep" as const,
    appearsOn: "Trang chủ & Tin tức Hướng nghiệp",
  },
  {
    value: "visa-services",
    label: "Dịch vụ visa",
    portal: "huongnghiep" as const,
    appearsOn:
      "Khối tin Visa (nếu cấu hình) hoặc Tin tức Hướng nghiệp theo category",
  },
  {
    value: "japanese-training",
    label: "Luyện thi tiếng Nhật",
    portal: "luyenthi" as const,
    appearsOn: "Trang chủ & Tin tức Luyện thi",
  },
  {
    value: "soft-skills",
    label: "Kỹ năng mềm / Dịch vụ",
    portal: "dichvu" as const,
    appearsOn: "Trang chủ & Tin tức Dịch vụ",
  },
] as const;

export type ArticleCategoryValue = (typeof ARTICLE_CATEGORIES)[number]["value"];

const BY_VALUE = Object.fromEntries(
  ARTICLE_CATEGORIES.map((c) => [c.value, c]),
) as Record<ArticleCategoryValue, (typeof ARTICLE_CATEGORIES)[number]>;

export function isArticleCategory(value: string): value is ArticleCategoryValue {
  return value in BY_VALUE;
}

export function articleCategoryLabel(category: string): string {
  return BY_VALUE[category as ArticleCategoryValue]?.label || category;
}

export function articleCategoryMeta(category: string) {
  return BY_VALUE[category as ArticleCategoryValue] || null;
}

/** Map article category → portal (source of truth for listings). */
export function portalFromArticleCategory(category: string): ArticlePortalId {
  const meta = articleCategoryMeta(category);
  return meta?.portal ?? "group";
}

export function categoriesForPortal(portal: ArticlePortalId | "all" | string) {
  if (portal === "all" || portal === "group") return [...ARTICLE_CATEGORIES];
  return ARTICLE_CATEGORIES.filter((c) => c.portal === portal);
}

export function defaultCategoryForPortal(
  portal: ArticlePortalId | string,
): ArticleCategoryValue {
  const list = categoriesForPortal(portal);
  return list[0]?.value ?? "study-abroad";
}
