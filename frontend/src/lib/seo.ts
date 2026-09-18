/** Site-wide SEO defaults (client). Absolute URLs use window origin in browser. */

export const SEO_SITE_NAME = "Trí Nhân Academy";
export const SEO_DEFAULT_DESCRIPTION =
  "Trí Nhân Academy — hướng nghiệp, du học, dịch vụ biên phiên dịch & kỹ năng mềm, luyện thi tiếng Nhật. Đồng hành lộ trình học tập và phát triển nghề nghiệp.";
export const SEO_DEFAULT_OG_IMAGE = "/brand/trinhan-academy-logo.png";
export const SEO_LOCALE = "vi_VN";

export function seoOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "https://trinhanacademy.com";
}

export function absoluteSeoUrl(pathOrUrl: string): string {
  const raw = (pathOrUrl || "").trim();
  if (!raw) return seoOrigin();
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${seoOrigin()}${path}`;
}

export function buildPageTitle(pageTitle: string, siteName = SEO_SITE_NAME): string {
  const t = pageTitle.trim();
  if (!t) return siteName;
  if (t === siteName || t.includes(siteName)) return t;
  return `${t} | ${siteName}`;
}

export function truncateMetaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}
