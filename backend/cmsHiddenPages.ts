import { pool } from "./db";
import {
  canDeletePageContent,
  getPageContentEntry,
} from "@shared/pageContentRegistry";
import { deleteCmsPage, getCmsPageById } from "./cmsPages";
import type { UiImagePurgeResult } from "./uiImageCleanup";

let tableReady: Promise<void> | null = null;

async function ensureHiddenPagesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cms_hidden_pages (
          page_id text PRIMARY KEY,
          hidden_at timestamp NOT NULL DEFAULT now()
        )
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

export async function listHiddenPageIds(): Promise<string[]> {
  await ensureHiddenPagesTable();
  const result = await pool.query<{ page_id: string }>(
    `SELECT page_id FROM cms_hidden_pages ORDER BY hidden_at ASC`,
  );
  return result.rows.map((r) => r.page_id);
}

export async function isPageHidden(pageId: string): Promise<boolean> {
  await ensureHiddenPagesTable();
  const result = await pool.query(
    `SELECT 1 FROM cms_hidden_pages WHERE page_id = $1 LIMIT 1`,
    [pageId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function hideRegistryPage(pageId: string): Promise<boolean> {
  const entry = getPageContentEntry(pageId);
  if (!entry) return false;
  if (!canDeletePageContent(entry)) {
    throw new Error("Không thể xóa trang chủ cổng — chỉ được xóa trang con.");
  }
  if (entry.isCustom) {
    throw new Error("Trang tùy chỉnh phải xóa qua cms_pages");
  }
  await ensureHiddenPagesTable();
  await pool.query(
    `INSERT INTO cms_hidden_pages (page_id) VALUES ($1)
     ON CONFLICT (page_id) DO NOTHING`,
    [pageId],
  );
  return true;
}

/**
 * Delete custom CMS page or hide a static registry child page.
 * Portal home pages are rejected.
 */
export async function deleteOrHidePageContent(id: string): Promise<{
  deleted: boolean;
  mode?: "custom" | "hidden";
  images?: UiImagePurgeResult;
}> {
  const custom = await getCmsPageById(id);
  if (custom) {
    const result = await deleteCmsPage(id);
    return { ...result, mode: result.deleted ? "custom" : undefined };
  }

  const entry = getPageContentEntry(id);
  if (!entry) return { deleted: false };
  if (!canDeletePageContent(entry)) {
    throw new Error("Không thể xóa trang chủ cổng — chỉ được xóa trang con.");
  }

  const ok = await hideRegistryPage(id);
  return { deleted: ok, mode: ok ? "hidden" : undefined };
}

/** Public paths that should 404 after admin hides the page (scoped by portal). */
export async function listHiddenPublicPathEntries(): Promise<
  Array<{ portal: string; path: string }>
> {
  const ids = await listHiddenPageIds();
  const entries: Array<{ portal: string; path: string }> = [];
  for (const id of ids) {
    const entry = getPageContentEntry(id);
    if (entry?.publicPath && entry.publicPath !== "/") {
      entries.push({ portal: entry.portal, path: entry.publicPath });
    }
  }
  return entries;
}

/** @deprecated Prefer listHiddenPublicPathEntries — flat paths collide across portals. */
export async function listHiddenPublicPaths(): Promise<string[]> {
  const entries = await listHiddenPublicPathEntries();
  return [...new Set(entries.map((e) => e.path))];
}
