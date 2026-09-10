import type { LayoutPageId } from "./pageSections";
import { toPublicPortalPath, type PortalId } from "./portal";
import { getSiteContentDefaults } from "./siteContentDefaults";
import {
  PORTAL_SECTION_CATALOG,
} from "./portalSectionCatalog";

export type PageEditorMode = "blocks" | "legacy";

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
 * Child pages may be removed from Cpanel (hidden).
 * Portal homes and hub-only pages stay.
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
    label: "Trang chủ",
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
    id: "huongnghiep-home",
    portal: "huongnghiep",
    label: "Giới thiệu",
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
    id: "visa-services",
    portal: "huongnghiep",
    label: "Visa",
    description: "Trang dịch vụ visa — bố cục khối",
    publicPath: pub("huongnghiep", "/visa-services"),
    editor: "blocks",
    layoutKey: "visa-services",
    sectionTemplate: "huongnghiep",
    imageSlots: [
      { type: "visa-hero", label: "Banner hero" },
      { type: "visa-service", label: "Dịch vụ visa" },
      { type: "visa-consultation", label: "Tư vấn visa" },
    ],
  },
  {
    id: "dichvu-home",
    portal: "dichvu",
    label: "Giới thiệu",
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
    label: "Luyện thi",
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
    label: "Khóa học",
    description: "Tiêu đề & mô tả trang danh sách lớp — văn bản",
    publicPath: pub("luyenthi", "/classes"),
    editor: "legacy",
    siteContentsPage: "classes",
    imageSlots: [],
  },
  {
    id: "luyenthi-news",
    portal: "luyenthi",
    label: "Tin tức",
    description: "Tin tức cổng Luyện thi — bố cục khối",
    publicPath: pub("luyenthi", "/news"),
    editor: "blocks",
    layoutKey: "luyenthi-news",
    sectionTemplate: "luyenthi",
    imageSlots: [],
  },
  {
    id: "huongnghiep-news",
    portal: "huongnghiep",
    label: "Tin tức",
    description: "Tin tức cổng Hướng nghiệp — bố cục khối",
    publicPath: pub("huongnghiep", "/news"),
    editor: "blocks",
    layoutKey: "huongnghiep-news",
    sectionTemplate: "huongnghiep",
    imageSlots: [],
  },
  ...PORTAL_SECTION_CATALOG.map(
    (s): PageContentEntry => ({
      id: `section-${s.slug}`,
      portal: s.portal,
      label: s.label,
      description: `Trang con ${s.publicPath} — bố cục khối`,
      publicPath: s.publicPath,
      editor: "blocks",
      layoutKey: `section-${s.slug}`,
      sectionTemplate:
        s.portal === "huongnghiep"
          ? "huongnghiep"
          : s.portal === "dichvu"
            ? "dichvu"
            : "group",
      imageSlots: [],
    }),
  ),
];

export function getPagesForPortal(portal: PortalId | "all"): PageContentEntry[] {
  const list =
    portal === "all"
      ? [...PAGE_CONTENT_REGISTRY]
      : PAGE_CONTENT_REGISTRY.filter((p) => p.portal === portal);
  return list.sort(comparePageContentEntries);
}

/** Portal order on hub header: Đào tạo(group) → Hướng nghiệp → Dịch vụ → Luyện thi */
const PORTAL_NAV_ORDER: PortalId[] = [
  "group",
  "huongnghiep",
  "dichvu",
  "luyenthi",
];

/** Within-portal order matching header child links. */
const PAGE_PATH_NAV_ORDER: Record<PortalId, string[]> = {
  group: [pub("group", "/")],
  huongnghiep: [
    pub("huongnghiep", "/"),
    pub("huongnghiep", "/du-hoc"),
    pub("huongnghiep", "/di-lam"),
    pub("huongnghiep", "/dao-tao-nghe"),
    pub("huongnghiep", "/visa-services"),
    pub("huongnghiep", "/news"),
  ],
  dichvu: [
    pub("dichvu", "/"),
    pub("dichvu", "/bien-phien-dich"),
    pub("dichvu", "/ky-nang-mem"),
    pub("dichvu", "/tu-van-doanh-nghiep"),
  ],
  luyenthi: [
    pub("luyenthi", "/"),
    pub("luyenthi", "/classes"),
    pub("luyenthi", "/news"),
  ],
};

/**
 * Whether renaming this page updates a header child-nav label.
 * Hub chips (Đào tạo→tnjs, Hướng nghiệp/Dịch vụ/Luyện thi, Tư vấn) are code-defined.
 */
export function pageUpdatesHeaderNav(entry: PageContentEntry): boolean {
  if (entry.isCustom) return false;
  if (entry.portal === "group") return false;
  const order = PAGE_PATH_NAV_ORDER[entry.portal] || [];
  return order.includes(entry.publicPath);
}

/** Short hint under the page name in Cpanel. */
export function pageNavHint(entry: PageContentEntry): string {
  if (entry.isCustom) {
    return "Trang tùy chỉnh — không tự thêm vào header";
  }
  if (entry.portal === "group" && isPortalHomePage(entry)) {
    return "Trang chủ hub · logo mở trang này · «Tư vấn» trên header tới #tu-van";
  }
  if (pageUpdatesHeaderNav(entry)) {
    return "Có trên menu con của cổng";
  }
  return "Không nằm trên header";
}

function pathNavIndex(entry: PageContentEntry): number {
  const order = PAGE_PATH_NAV_ORDER[entry.portal] || [];
  const idx = order.indexOf(entry.publicPath);
  return idx === -1 ? order.length + 100 : idx;
}

/** Sort like header: portal hubs order, then child nav order, custom pages last. */
export function comparePageContentEntries(
  a: PageContentEntry,
  b: PageContentEntry,
): number {
  const pa = PORTAL_NAV_ORDER.indexOf(a.portal);
  const pb = PORTAL_NAV_ORDER.indexOf(b.portal);
  const portalCmp = (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  if (portalCmp !== 0) return portalCmp;

  if (!!a.isCustom !== !!b.isCustom) return a.isCustom ? 1 : -1;

  const pathCmp = pathNavIndex(a) - pathNavIndex(b);
  if (pathCmp !== 0) return pathCmp;

  return a.label.localeCompare(b.label, "vi");
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
  return PAGE_CONTENT_REGISTRY.filter(
    (p) => p.editor === "blocks" && (p.layoutPageId || p.layoutKey),
  );
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
