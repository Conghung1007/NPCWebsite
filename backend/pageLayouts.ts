import { and, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { pageLayouts } from "@shared/schema";
import { PORTAL_BLOCK_TEMPLATE } from "@shared/cmsPages";
import { isPortalId } from "@shared/portal";
import {
  defaultLayoutForPage,
  defaultCustomPageLayout,
  isLayoutPageId,
  normalizeSections,
  pageSectionSchema,
  type LayoutPageId,
  type PageSection,
} from "@shared/pageSections";

let tableReady: Promise<void> | null = null;

export async function ensurePageLayoutsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_layouts (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          page text NOT NULL,
          portal text NOT NULL DEFAULT 'group',
          sections jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS page_layouts_page_portal_idx
        ON page_layouts (page, portal)
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

function parseSections(raw: unknown): PageSection[] {
  if (!Array.isArray(raw)) return [];
  const out: PageSection[] = [];
  for (const item of raw) {
    const parsed = pageSectionSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function resolveTemplate(page: string, portal: string): LayoutPageId {
  if (isLayoutPageId(page)) return page;
  if (isPortalId(portal)) return PORTAL_BLOCK_TEMPLATE[portal];
  return "group";
}

export async function getPageLayout(
  page: string,
  portal: string = "group",
): Promise<{ page: string; portal: string; sections: PageSection[]; isDefault: boolean }> {
  await ensurePageLayoutsTable();
  const template = resolveTemplate(page, portal);

  const rows = await db
    .select()
    .from(pageLayouts)
    .where(and(eq(pageLayouts.page, page), eq(pageLayouts.portal, portal)))
    .limit(1);

  if (rows[0]) {
    return {
      page,
      portal,
      sections: normalizeSections(
        page,
        parseSections(rows[0].sections),
        template,
      ),
      isDefault: false,
    };
  }

  if (isLayoutPageId(page)) {
    return {
      page,
      portal,
      sections: normalizeSections(page, defaultLayoutForPage(page)),
      isDefault: true,
    };
  }

  return { page, portal, sections: [], isDefault: true };
}

export async function savePageLayout(
  page: string,
  portal: string,
  sections: PageSection[],
): Promise<{ page: string; portal: string; sections: PageSection[]; isDefault: boolean }> {
  await ensurePageLayoutsTable();
  const template = resolveTemplate(page, portal);
  const normalized = normalizeSections(page, sections, template);

  const existing = await db
    .select()
    .from(pageLayouts)
    .where(and(eq(pageLayouts.page, page), eq(pageLayouts.portal, portal)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pageLayouts)
      .set({ sections: normalized, updatedAt: new Date() })
      .where(eq(pageLayouts.id, existing[0].id));
  } else {
    await db.insert(pageLayouts).values({
      page,
      portal,
      sections: normalized,
    });
  }

  return { page, portal, sections: normalized, isDefault: false };
}

export async function resetPageLayout(
  page: string,
  portal: string,
): Promise<{ page: string; portal: string; sections: PageSection[]; isDefault: boolean }> {
  await ensurePageLayoutsTable();
  const template = resolveTemplate(page, portal);
  const sections = isLayoutPageId(page)
    ? normalizeSections(page, defaultLayoutForPage(page))
    : normalizeSections(
        page,
        defaultCustomPageLayout(template, {
          title: "Nội dung trang",
          description: "",
          imagePrefix: page.replace(/[^a-z0-9-]/gi, "").slice(0, 12) || "page",
        }),
        template,
      );

  const existing = await db
    .select()
    .from(pageLayouts)
    .where(and(eq(pageLayouts.page, page), eq(pageLayouts.portal, portal)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pageLayouts)
      .set({ sections, updatedAt: new Date() })
      .where(eq(pageLayouts.id, existing[0].id));
  } else {
    await db.insert(pageLayouts).values({ page, portal, sections });
  }

  return { page, portal, sections, isDefault: false };
}

export async function deletePageLayout(page: string, portal: string): Promise<void> {
  await ensurePageLayoutsTable();
  await db
    .delete(pageLayouts)
    .where(and(eq(pageLayouts.page, page), eq(pageLayouts.portal, portal)));
}

