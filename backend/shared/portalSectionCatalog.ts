import {
  PORTAL_HOME_SEGMENT,
  toPublicPortalPath,
  type PortalId,
} from "./portal";

/** Metadata for portal sub-pages (content lives in portal-sections.tsx defaults + site_contents). */
export const PORTAL_SECTION_CATALOG: Array<{
  slug: string;
  portal: PortalId;
  label: string;
  publicPath: string;
}> = [
  {
    slug: "du-hoc",
    portal: "huongnghiep",
    label: "Du học (track)",
    publicPath: toPublicPortalPath("huongnghiep", "/du-hoc"),
  },
  {
    slug: "di-lam",
    portal: "huongnghiep",
    label: "Đi làm (track)",
    publicPath: toPublicPortalPath("huongnghiep", "/di-lam"),
  },
  {
    slug: "dao-tao-nghe",
    portal: "huongnghiep",
    label: "Đào tạo nghề (track)",
    publicPath: toPublicPortalPath("huongnghiep", "/dao-tao-nghe"),
  },
  {
    slug: "countries",
    portal: "huongnghiep",
    label: "Quốc gia du học",
    publicPath: toPublicPortalPath("huongnghiep", "/countries"),
  },
  {
    slug: "schools",
    portal: "huongnghiep",
    label: "Trường học",
    publicPath: toPublicPortalPath("huongnghiep", "/schools"),
  },
  {
    slug: "costs",
    portal: "huongnghiep",
    label: "Chi phí du học",
    publicPath: toPublicPortalPath("huongnghiep", "/costs"),
  },
  {
    slug: "documents",
    portal: "huongnghiep",
    label: "Hồ sơ du học",
    publicPath: toPublicPortalPath("huongnghiep", "/documents"),
  },
  {
    slug: "faq",
    portal: "huongnghiep",
    label: "FAQ du học",
    publicPath: toPublicPortalPath("huongnghiep", "/faq"),
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
  {
    slug: "courses",
    portal: "dichvu",
    label: "Khóa học",
    publicPath: toPublicPortalPath("dichvu", "/courses"),
  },
  {
    slug: "schedule",
    portal: "dichvu",
    label: "Lịch khai giảng",
    publicPath: toPublicPortalPath("dichvu", "/schedule"),
  },
  {
    slug: "enterprise",
    portal: "dichvu",
    label: "Doanh nghiệp",
    publicPath: toPublicPortalPath("dichvu", "/enterprise"),
  },
];

export function portalSectionSitePage(slug: string): string {
  return `section-${slug}`;
}

export { PORTAL_HOME_SEGMENT };
