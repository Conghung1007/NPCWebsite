import { pool } from "./db";
import { allocateUniqueSlug, slugifyTitle } from "@shared/contentSlug";

let ready: Promise<void> | null = null;

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [table, column],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Ensure articles.slug / exams.slug exist and backfill from titles.
 */
export async function ensureContentSlugs(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!(await columnExists("articles", "slug"))) {
        await pool.query(`ALTER TABLE articles ADD COLUMN slug text`);
      }
      if (!(await columnExists("exams", "slug"))) {
        await pool.query(`ALTER TABLE exams ADD COLUMN slug text`);
      }

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS articles_portal_slug_uidx
        ON articles (portal, slug) WHERE slug IS NOT NULL AND slug <> ''
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS exams_slug_uidx
        ON exams (slug) WHERE slug IS NOT NULL AND slug <> ''
      `);

      const articleRows = await pool.query<{
        id: string;
        title: string;
        portal: string;
        slug: string | null;
      }>(`SELECT id, title, portal, slug FROM articles`);

      const usedArticle = new Set(
        articleRows.rows
          .filter((r) => r.slug)
          .map((r) => `${r.portal}::${r.slug}`),
      );

      for (const row of articleRows.rows) {
        if (row.slug) continue;
        const slug = await allocateUniqueSlug(row.title, async (s) =>
          usedArticle.has(`${row.portal}::${s}`),
        );
        usedArticle.add(`${row.portal}::${slug}`);
        await pool.query(`UPDATE articles SET slug = $1 WHERE id = $2`, [
          slug,
          row.id,
        ]);
      }

      const examRows = await pool.query<{
        id: string;
        title: string;
        slug: string | null;
      }>(`SELECT id, title, slug FROM exams`);

      const usedExam = new Set(
        examRows.rows.filter((r) => r.slug).map((r) => r.slug as string),
      );

      for (const row of examRows.rows) {
        if (row.slug) continue;
        const slug = await allocateUniqueSlug(row.title, async (s) =>
          usedExam.has(s),
        );
        usedExam.add(slug);
        await pool.query(`UPDATE exams SET slug = $1 WHERE id = $2`, [
          slug,
          row.id,
        ]);
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
}

export { slugifyTitle };
