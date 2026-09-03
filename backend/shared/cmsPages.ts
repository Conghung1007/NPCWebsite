import { z } from "zod";
import { PORTAL_IDS, type PortalId } from "./portal";
import type { LayoutPageId } from "./pageSections";
import type { PageContentEntry } from "./pageContentRegistry";

/** Block whitelist template per portal (inherits from portal home). */
export const PORTAL_BLOCK_TEMPLATE: Record<PortalId, LayoutPageId> = {
  group: "group",
  huongnghiep: "huongnghiep",
  dichvu: "dichvu",
  luyenthi: "luyenthi",
};

/** URL slugs reserved by static app routes — custom pages cannot use these. */
export const RESERVED_CMS_SLUGS = new Set([
  "api",
  "assets",
  "static",
  "objects",
  "company",
  "visa-services",
  "study-abroad",
  "japanese-training",
  "du-hoc",
  "di-lam",
  "dao-tao-nghe",
  "bien-phien-dich",
  "ky-nang-mem",
  "tu-van-doanh-nghiep",
  "classes",
  "cart",
  "checkout",
  "online-exam",
  "login",
  "register",
  "register-success",
  "forgot-password",
  "profile",
  "contact",
  "news",
  "countries",
  "schools",
  "costs",
  "documents",
  "faq",
  "courses",
  "schedule",
  "enterprise",
  "article",
  "create-article",
  "edit-article",
  "create-exam",
  "edit-exam",
  "manage",
  "cpanel",
  "exam",
  "exam-result",
  "exam-attempts",
  "certificate",
]);

export function normalizeCmsSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateCmsSlug(slug: string): string | null {
  if (!slug || slug.length < 2) return "Slug phải có ít nhất 2 ký tự";
  if (slug.length > 64) return "Slug quá dài (tối đa 64 ký tự)";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug chỉ gồm chữ thường, số và dấu gạch ngang";
  }
  if (RESERVED_CMS_SLUGS.has(slug)) return "Slug này đã được hệ thống dùng";
  return null;
}

export const createCmsPageSchema = z.object({
  portal: z.enum(PORTAL_IDS),
  slug: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  imagePrefix: z.string().max(64).optional(),
});

export type CreateCmsPageInput = z.infer<typeof createCmsPageSchema>;

export type CmsPageRow = {
  id: string;
  portal: PortalId;
  slug: string;
  label: string;
  description: string;
  imagePrefix: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export function cmsPageToContentEntry(row: CmsPageRow): PageContentEntry {
  return {
    id: row.id,
    portal: row.portal,
    label: row.label,
    description: row.description || "Trang khối tùy chỉnh",
    publicPath: `/${row.slug}`,
    editor: "blocks",
    layoutKey: row.id,
    sectionTemplate: PORTAL_BLOCK_TEMPLATE[row.portal],
    isCustom: true,
    imageSlots: [],
  };
}
