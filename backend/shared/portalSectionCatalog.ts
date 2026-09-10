import {
  toPublicPortalPath,
  type PortalId,
} from "./portal";

/**
 * Child pages that appear in header nav (and thus in Cpanel «Nội dung trang»).
 * Extra legacy helpers (countries, faq, …) were removed from the CMS list.
 */
export const PORTAL_SECTION_CATALOG: Array<{
  slug: string;
  portal: PortalId;
  label: string;
  publicPath: string;
}> = [
  {
    slug: "du-hoc",
    portal: "huongnghiep",
    label: "Du học",
    publicPath: toPublicPortalPath("huongnghiep", "/du-hoc"),
  },
  {
    slug: "di-lam",
    portal: "huongnghiep",
    label: "Đi làm",
    publicPath: toPublicPortalPath("huongnghiep", "/di-lam"),
  },
  {
    slug: "dao-tao-nghe",
    portal: "huongnghiep",
    label: "Đào tạo nghề",
    publicPath: toPublicPortalPath("huongnghiep", "/dao-tao-nghe"),
  },
  {
    slug: "bien-phien-dich",
    portal: "dichvu",
    label: "Biên phiên dịch",
    publicPath: toPublicPortalPath("dichvu", "/bien-phien-dich"),
  },
  {
    slug: "ky-nang-mem",
    portal: "dichvu",
    label: "Kỹ năng mềm",
    publicPath: toPublicPortalPath("dichvu", "/ky-nang-mem"),
  },
  {
    slug: "tu-van-doanh-nghiep",
    portal: "dichvu",
    label: "Tư vấn doanh nghiệp",
    publicPath: toPublicPortalPath("dichvu", "/tu-van-doanh-nghiep"),
  },
];

export function portalSectionSitePage(slug: string): string {
  return `section-${slug}`;
}
