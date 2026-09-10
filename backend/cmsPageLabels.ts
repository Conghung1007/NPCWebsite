import { pool } from "./db";
import { getPageContentEntry } from "@shared/pageContentRegistry";
import { z } from "zod";

let tableReady: Promise<void> | null = null;

async function ensurePageLabelsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cms_page_labels (
          page_id text PRIMARY KEY,
          label text NOT NULL,
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

export type PageLabelMap = Record<string, string>;

export type PageLabelPathEntry = {
  pageId: string;
  portal: string;
  path: string;
  label: string;
};

export async function listPageLabelOverrides(): Promise<PageLabelMap> {
  await ensurePageLabelsTable();
  const result = await pool.query<{ page_id: string; label: string }>(
    `SELECT page_id, label FROM cms_page_labels`,
  );
  const map: PageLabelMap = {};
  for (const row of result.rows) {
    map[row.page_id] = row.label;
  }
  return map;
}

/** Public path + portal for header sync. */
export async function listPageLabelPathEntries(): Promise<PageLabelPathEntry[]> {
  const map = await listPageLabelOverrides();
  const entries: PageLabelPathEntry[] = [];
  for (const [pageId, label] of Object.entries(map)) {
    const entry = getPageContentEntry(pageId);
    if (!entry?.publicPath) continue;
    entries.push({
      pageId,
      portal: entry.portal,
      path: entry.publicPath,
      label,
    });
  }
  return entries;
}

export const upsertPageLabelSchema = z.object({
  label: z.string().trim().min(1, "Nhập tên trang").max(120),
});

/**
 * Set display label for a static registry page.
 * Returns null if page_id is not a registry entry.
 */
export async function upsertRegistryPageLabel(
  pageId: string,
  label: string,
): Promise<{ pageId: string; label: string; publicPath: string; portal: string } | null> {
  const entry = getPageContentEntry(pageId);
  if (!entry || entry.isCustom) return null;

  const trimmed = label.trim();
  if (!trimmed) throw new Error("Nhập tên trang");
  if (trimmed.length > 120) throw new Error("Tên trang tối đa 120 ký tự");

  await ensurePageLabelsTable();
  await pool.query(
    `INSERT INTO cms_page_labels (page_id, label, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (page_id) DO UPDATE
     SET label = EXCLUDED.label, updated_at = now()`,
    [pageId, trimmed],
  );

  return {
    pageId,
    label: trimmed,
    publicPath: entry.publicPath,
    portal: entry.portal,
  };
}

export async function clearRegistryPageLabel(pageId: string): Promise<boolean> {
  await ensurePageLabelsTable();
  const result = await pool.query(
    `DELETE FROM cms_page_labels WHERE page_id = $1`,
    [pageId],
  );
  return (result.rowCount ?? 0) > 0;
}
