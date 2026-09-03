import { and, asc, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { cmsPages } from "@shared/schema";
import {
  createCmsPageSchema,
  normalizeCmsSlug,
  PORTAL_BLOCK_TEMPLATE,
  validateCmsSlug,
  type CmsPageRow,
} from "@shared/cmsPages";
import { defaultCustomPageLayout, collectImageTypesFromSections } from "@shared/pageSections";
import { getPageLayout, savePageLayout, deletePageLayout } from "./pageLayouts";
import { purgeUiImageSlots, type UiImagePurgeResult } from "./uiImageCleanup";
import type { PortalId } from "@shared/portal";

let tableReady: Promise<void> | null = null;

export async function ensureCmsPagesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cms_pages (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          portal text NOT NULL,
          slug text NOT NULL,
          label text NOT NULL,
          description text NOT NULL DEFAULT '',
          image_prefix text NOT NULL DEFAULT '',
          sort_order integer NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS cms_pages_portal_slug_idx
        ON cms_pages (portal, slug)
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

function rowToCmsPage(row: typeof cmsPages.$inferSelect): CmsPageRow {
  return {
    id: row.id,
    portal: row.portal as PortalId,
    slug: row.slug,
    label: row.label,
    description: row.description ?? "",
    imagePrefix: row.imagePrefix ?? "",
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCmsPages(portal?: PortalId): Promise<CmsPageRow[]> {
  await ensureCmsPagesTable();
  const rows = portal
    ? await db
        .select()
        .from(cmsPages)
        .where(eq(cmsPages.portal, portal))
        .orderBy(asc(cmsPages.sortOrder), asc(cmsPages.label))
    : await db
        .select()
        .from(cmsPages)
        .orderBy(asc(cmsPages.portal), asc(cmsPages.sortOrder), asc(cmsPages.label));
  return rows.map(rowToCmsPage);
}

export async function getCmsPageBySlug(
  portal: PortalId,
  slug: string,
): Promise<CmsPageRow | null> {
  await ensureCmsPagesTable();
  const rows = await db
    .select()
    .from(cmsPages)
    .where(and(eq(cmsPages.portal, portal), eq(cmsPages.slug, slug)))
    .limit(1);
  return rows[0] ? rowToCmsPage(rows[0]) : null;
}

export async function getCmsPageById(id: string): Promise<CmsPageRow | null> {
  await ensureCmsPagesTable();
  const rows = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
  return rows[0] ? rowToCmsPage(rows[0]) : null;
}

export async function createCmsPage(input: unknown): Promise<CmsPageRow> {
  await ensureCmsPagesTable();
  const data = createCmsPageSchema.parse(input);
  const slug = normalizeCmsSlug(data.slug);
  const slugError = validateCmsSlug(slug);
  if (slugError) throw new Error(slugError);

  const existing = await getCmsPageBySlug(data.portal, slug);
  if (existing) throw new Error("Slug đã tồn tại trong portal này");

  const imagePrefix = (data.imagePrefix?.trim() || slug).replace(/[^a-z0-9-]/g, "-");

  const [row] = await db
    .insert(cmsPages)
    .values({
      portal: data.portal,
      slug,
      label: data.label.trim(),
      description: (data.description ?? "").trim(),
      imagePrefix,
    })
    .returning();

  const page = rowToCmsPage(row);
  const template = PORTAL_BLOCK_TEMPLATE[data.portal];
  const sections = defaultCustomPageLayout(template, {
    title: data.label.trim(),
    description: (data.description ?? "").trim(),
    imagePrefix,
  }).map((s, i) => ({
    ...s,
    id: `${s.type}-${page.id.slice(0, 8)}-${i}`,
    sortOrder: i,
  }));

  try {
    await savePageLayout(page.id, data.portal, sections);
  } catch (err) {
    await db.delete(cmsPages).where(eq(cmsPages.id, page.id));
    throw err;
  }

  return page;
}

export async function deleteCmsPage(id: string): Promise<{
  deleted: boolean;
  images?: UiImagePurgeResult;
}> {
  await ensureCmsPagesTable();
  const existing = await getCmsPageById(id);
  if (!existing) return { deleted: false };

  const layout = await getPageLayout(id, existing.portal);
  const imageTypes = collectImageTypesFromSections(layout.sections, {
    imagePrefix: existing.imagePrefix,
  });

  await deletePageLayout(id, existing.portal);
  await db.delete(cmsPages).where(eq(cmsPages.id, id));

  const images =
    imageTypes.length > 0
      ? await purgeUiImageSlots(existing.portal, imageTypes)
      : { dbRemoved: 0, r2Removed: 0, r2Skipped: 0, slots: [] };

  return { deleted: true, images };
}
