import type { LayoutPageId } from "./pageSections";
import { toPublicPortalPath, type PortalId } from "./portal";
import { getSiteContentDefaults } from "./siteContentDefaults";
import {
  PORTAL_SECTION_CATALOG,
  portalSectionSitePage,
} from "./portalSectionCatalog";

export type PageEditorMode = "blocks" | "legacy" | "portal-section";

export type PageContentEntry = {
  id: string;
  portal: PortalId;
  label: string;
  description: string;
  publicPath: string;
  /** URL slug (custom CMS pages); omit for static registry entries */
  slug?: string;
  editor: PageEditorMode;
  layoutPageId?: LayoutPageId;
  /** DB key in page_layouts for custom block pages (cms_pages.id) */
  layoutKey?: string;
  /** Section whitelist source for custom pages */
  sectionTemplate?: LayoutPageId;
  /** User-created page — can be deleted from cpanel */
  isCustom?: boolean;
  siteContentsPage?: string;
  sectionSlug?: string;
  /** Primary ui_images slots for this page (admin media tab) */
  imageSlots: Array<{ type: string; label: string }>;
};

function pub(portal: PortalId, path: string): string {
  return toPublicPortalPath(portal, path);
}

/** Portal homepage — never deletable from Cpanel. */
export function isPortalHomePage(entry: PageContentEntry): boolean {
  if (!entry.layoutPageId || entry.editor !== "blocks" || entry.isCustom) {
    return false;
  }
  const home = pub(entry.portal, "/");
  return entry.publicPath === home || entry.publicPath === "/";
}

/**
 * Child pages (legacy / portal-section / custom) may be removed from Cpanel.
 * Portal homes stay — “một trang cho một cổng”.
 */
export function canDeletePageContent(entry: PageContentEntry): boolean {
  if (isPortalHomePage(entry)) return false;
  return true;
}

/** Single registry — maps public pages to their admin editor (TNJS-style CMS hub). */
export const PAGE_CONTENT_REGISTRY: PageContentEntry[] = [
  {
    id: "group-home",
    portal: "group",
    label: "Trang chủ Trí Nhân Academy",
    description: "Hero, 4 trụ cột, form tư vấn — bố cục khối",
    publicPath: pub("group", "/"),
    editor: "blocks",
    layoutPageId: "group",
    imageSlots: [
      { type: "group-hero", label: "Banner hero" },
      { type: "group-hero-1", label: "Banner hero (slide 2)" },
      { type: "group-pillar-0", label: "Ảnh trụ Đào tạo" },
      { type: "group-pillar-1", label: "Ảnh trụ Hướng nghiệp" },
      { type: "group-pillar-2", label: "Ảnh trụ Dịch vụ" },
      { type: "group-pillar-3", label: "Ảnh trụ Luyện thi" },
    ],
  },
  {
    id: "japanese-training",
    portal: "group",
    label: "Đào tạo TNJS",
    description: "Trang khóa học tiếng Nhật — văn bản & ảnh",
    publicPath: pub("group", "/japanese-training"),
    editor: "legacy",
    siteContentsPage: "japanese",
    imageSlots: [
      { type: "japanese-hero", label: "Banner hero" },
      { type: "japanese-hero-1", label: "Hero slide 2" },
      { type: "japanese-hero-2", label: "Hero slide 3" },
      { type: "japanese-why", label: "Vì sao chọn TNJS" },
      { type: "japanese-classroom", label: "Lớp học" },
      { type: "japanese-course-0", label: "Khóa học 1" },
      { type: "japanese-course-1", label: "Khóa học 2" },
      { type: "japanese-course-2", label: "Khóa học 3" },
      { type: "japanese-course-3", label: "Khóa học 4" },
      { type: "instructor-1", label: "Giảng viên 1" },
      { type: "instructor-2", label: "Giảng viên 2" },
      { type: "instructor-3", label: "Giảng viên 3" },
    ],
  },
  {
    id: "huongnghiep-home",
    portal: "huongnghiep",
    label: "Trang chủ Hướng nghiệp",
    description: "Hero, lộ trình, phản hồi, tin bài — bố cục khối",
    publicPath: pub("huongnghiep", "/"),
    editor: "blocks",
    layoutPageId: "huongnghiep",
    imageSlots: [
      { type: "huongnghiep-hero", label: "Banner hero" },
      { type: "huongnghiep-hero-1", label: "Hero slide 2" },
      { type: "huongnghiep-track-0", label: "Lộ trình 1" },
      { type: "huongnghiep-track-1", label: "Lộ trình 2" },
      { type: "huongnghiep-track-2", label: "Lộ trình 3" },
    ],
  },
  {
    id: "study-abroad",
    portal: "huongnghiep",
    label: "Du học",
    description: "Trang dịch vụ du học — văn bản & ảnh",
    publicPath: pub("huongnghiep", "/study-abroad"),
    editor: "legacy",
    siteContentsPage: "study-abroad",
    imageSlots: [
      { type: "study-abroad-hero", label: "Banner hero" },
      { type: "study-abroad-students", label: "Hình học sinh" },
    ],
  },
  {
    id: "visa-services",
    portal: "huongnghiep",
    label: "Dịch vụ visa",
    description: "Trang dịch vụ visa — văn bản & ảnh",
    publicPath: pub("huongnghiep", "/visa-services"),
    editor: "legacy",
    siteContentsPage: "visa",
    imageSlots: [
      { type: "visa-hero", label: "Banner hero" },
      { type: "visa-service", label: "Dịch vụ visa" },
      { type: "visa-consultation", label: "Tư vấn visa" },
    ],
  },
  {
    id: "dichvu-home",
    portal: "dichvu",
    label: "Trang chủ Dịch vụ",
    description: "Hero, dịch vụ, form — bố cục khối",
    publicPath: pub("dichvu", "/"),
    editor: "blocks",
    layoutPageId: "dichvu",
    imageSlots: [
      { type: "dichvu-hero", label: "Banner hero" },
      { type: "dichvu-hero-1", label: "Hero slide 2" },
      { type: "dichvu-service-0", label: "Dịch vụ 1" },
      { type: "dichvu-service-1", label: "Dịch vụ 2" },
      { type: "dichvu-service-2", label: "Dịch vụ 3" },
    ],
  },
  {
    id: "luyenthi-home",
    portal: "luyenthi",
    label: "Trang Luyện thi",
    description: "Hero, giới thiệu, gói đề, danh sách đề — bố cục khối",
    publicPath: pub("luyenthi", "/"),
    editor: "blocks",
    layoutPageId: "luyenthi",
    imageSlots: [
      { type: "exam-hero", label: "Banner hero" },
      { type: "exam-hero-1", label: "Hero slide 2" },
      { type: "exam-feature-0", label: "Tính năng 1" },
      { type: "exam-feature-1", label: "Tính năng 2" },
      { type: "exam-feature-2", label: "Tính năng 3" },
    ],
  },
  {
    id: "luyenthi-classes",
    portal: "luyenthi",
    label: "Khóa học / Lớp đang tuyển",
    description: "Tiêu đề & mô tả trang danh sách lớp — văn bản",
    publicPath: pub("luyenthi", "/classes"),
    editor: "legacy",
    siteContentsPage: "classes",
    imageSlots: [],
  },
  {
    id: "luyenthi-news",
    portal: "luyenthi",
    label: "Tin tức luyện thi",
    description: "Tiêu đề & mô tả trang tin tức cổng Luyện thi",
    publicPath: pub("luyenthi", "/news"),
    editor: "legacy",
    siteContentsPage: "news",
    imageSlots: [],
  },
  {
    id: "luyenthi-contact",
    portal: "luyenthi",
    label: "Liên hệ (Luyện thi)",
    description: "Hero liên hệ cổng Luyện thi — văn bản & ảnh",
    publicPath: pub("luyenthi", "/contact"),
    editor: "legacy",
    siteContentsPage: "contact",
    imageSlots: [{ type: "contact-hero", label: "Banner hero" }],
  },
  {
    id: "huongnghiep-news",
    portal: "huongnghiep",
    label: "Tin tức hướng nghiệp",
    description: "Tiêu đề & mô tả trang tin tức cổng Hướng nghiệp",
    publicPath: pub("huongnghiep", "/news"),
    editor: "legacy",
    siteContentsPage: "news",
    imageSlots: [],
  },
  {
    id: "huongnghiep-contact",
    portal: "huongnghiep",
    label: "Liên hệ (Hướng nghiệp)",
    description: "Hero liên hệ cổng Hướng nghiệp — văn bản & ảnh",
    publicPath: pub("huongnghiep", "/contact"),
    editor: "legacy",
    siteContentsPage: "contact",
    imageSlots: [{ type: "contact-hero", label: "Banner hero" }],
  },
  {
    id: "dichvu-news",
    portal: "dichvu",
    label: "Tin tức dịch vụ",
    description: "Tiêu đề & mô tả trang tin tức cổng Dịch vụ",
    publicPath: pub("dichvu", "/news"),
    editor: "legacy",
    siteContentsPage: "news",
    imageSlots: [],
  },
  {
    id: "dichvu-contact",
    portal: "dichvu",
    label: "Liên hệ (Dịch vụ)",
    description: "Hero liên hệ cổng Dịch vụ — văn bản & ảnh",
    publicPath: pub("dichvu", "/contact"),
    editor: "legacy",
    siteContentsPage: "contact",
    imageSlots: [{ type: "contact-hero", label: "Banner hero" }],
  },
  {
    id: "group-contact",
    portal: "group",
    label: "Liên hệ (Trí Nhân Academy)",
    description: "Hero liên hệ trang tổng — văn bản & ảnh",
    publicPath: pub("group", "/contact"),
    editor: "legacy",
    siteContentsPage: "contact",
    imageSlots: [{ type: "contact-hero", label: "Banner hero" }],
  },
  ...PORTAL_SECTION_CATALOG.map(
    (s): PageContentEntry => ({
      id: `section-${s.slug}`,
      portal: s.portal,
      label: s.label,
      description: `Trang con ${s.publicPath} — văn bản & khối nội dung`,
      publicPath: s.publicPath,
      editor: "portal-section",
      sectionSlug: s.slug,
      siteContentsPage: portalSectionSitePage(s.slug),
      imageSlots: [],
    }),
  ),
];

export function getPagesForPortal(portal: PortalId | "all"): PageContentEntry[] {
  if (portal === "all") return PAGE_CONTENT_REGISTRY;
  return PAGE_CONTENT_REGISTRY.filter((p) => p.portal === portal);
}

export function getPageContentEntry(id: string): PageContentEntry | undefined {
  return PAGE_CONTENT_REGISTRY.find((p) => p.id === id);
}

/** Portal scope for page_layouts row */
export function getLayoutPortal(entry: PageContentEntry): string {
  return entry.portal;
}

/** DB `page` key in page_layouts */
export function getLayoutPageKey(entry: PageContentEntry): string {
  return entry.layoutKey ?? entry.layoutPageId ?? entry.portal;
}

/** Block pages only (for admin hints / routing). */
export function getBlockPageEntries(): PageContentEntry[] {
  return PAGE_CONTENT_REGISTRY.filter((p) => p.editor === "blocks" && p.layoutPageId);
}

/** Human-readable field label from site_contents key */
export function humanizeContentKey(key: string): string {
  return key
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Group keys by prefix (hero, process, list, …) for admin form sections */
export function groupContentKeys(keys: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of keys.sort()) {
    const prefix = key.includes("-") ? key.split("-")[0] : "general";
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(key);
  }
  return groups;
}

export function getPageContentDefaults(
  entry: PageContentEntry,
): Record<string, string> {
  if (!entry.siteContentsPage) return {};
  return getSiteContentDefaults(entry.siteContentsPage, entry.portal) || {};
}

export const GROUP_LABELS: Record<string, string> = {
  general: "Chung",
  hero: "Hero / Banner",
  brand: "Thương hiệu",
  process: "Quy trình",
  list: "Danh sách",
  eco: "Hệ sinh thái",
  login: "Đăng nhập",
  about: "Giới thiệu",
  why: "Vì sao chọn",
  course: "Khóa học",
  instructor: "Giảng viên",
  testimonial: "Phản hồi",
  cta: "Kêu gọi hành động",
  faqs: "FAQ (JSON)",
  documents: "Hồ sơ / tài liệu",
  empty: "Trạng thái trống",
  meta: "SEO / Meta",
  eyebrow: "Nhãn phụ",
};
