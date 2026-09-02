import type { PortalId } from "./portal";

/** Metadata for portal sub-pages (content lives in portal-sections.tsx defaults + site_contents). */
export const PORTAL_SECTION_CATALOG: Array<{
  slug: string;
  portal: PortalId;
  label: string;
  publicPath: string;
}> = [
  { slug: "du-hoc", portal: "huongnghiep", label: "Du học (track)", publicPath: "/du-hoc" },
  { slug: "di-lam", portal: "huongnghiep", label: "Đi làm (track)", publicPath: "/di-lam" },
  {
    slug: "dao-tao-nghe",
    portal: "huongnghiep",
    label: "Đào tạo nghề (track)",
    publicPath: "/dao-tao-nghe",
  },
  { slug: "countries", portal: "huongnghiep", label: "Quốc gia du học", publicPath: "/countries" },
  { slug: "schools", portal: "huongnghiep", label: "Trường học", publicPath: "/schools" },
  { slug: "costs", portal: "huongnghiep", label: "Chi phí du học", publicPath: "/costs" },
  { slug: "documents", portal: "huongnghiep", label: "Hồ sơ du học", publicPath: "/documents" },
  { slug: "faq", portal: "huongnghiep", label: "FAQ du học", publicPath: "/faq" },
  {
    slug: "bien-phien-dich",
    portal: "dichvu",
    label: "Biên phiên dịch",
    publicPath: "/bien-phien-dich",
  },
  {
    slug: "ky-nang-mem",
    portal: "dichvu",
    label: "Kỹ năng mềm",
    publicPath: "/ky-nang-mem",
  },
  {
    slug: "tu-van-doanh-nghiep",
    portal: "dichvu",
    label: "Tư vấn doanh nghiệp",
    publicPath: "/tu-van-doanh-nghiep",
  },
  { slug: "courses", portal: "dichvu", label: "Khóa học", publicPath: "/courses" },
  { slug: "schedule", portal: "dichvu", label: "Lịch khai giảng", publicPath: "/schedule" },
  { slug: "enterprise", portal: "dichvu", label: "Doanh nghiệp", publicPath: "/enterprise" },
];

export function portalSectionSitePage(slug: string): string {
  return `section-${slug}`;
}
