/**
 * Add portal columns + backfill + remap legacy portals + fix site_contents unique index.
 * Run: npx tsx scripts/ensurePortalColumns.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const alters = [
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'group'`,
      `ALTER TABLE ui_images ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'group'`,
      `ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'group'`,
      `ALTER TABLE site_contents ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'group'`,
      `ALTER TABLE courses ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'luyenthi'`,
      `ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'luyenthi'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'luyenthi'`,
      `ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'group'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS portals text[]`,
    ];
    for (const sql of alters) {
      await client.query(sql);
      console.log("ok:", sql.slice(0, 60) + "...");
    }

    await client.query(`DROP INDEX IF EXISTS site_contents_page_key_idx`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS site_contents_page_key_portal_idx
       ON site_contents (page, key, portal)`,
    );
    console.log("ok: site_contents unique index → page+key+portal");

    // Remap legacy portal IDs → new structure
    const remapTables = [
      "articles",
      "ui_images",
      "testimonials",
      "site_contents",
      "courses",
      "class_sessions",
      "orders",
      "contact_requests",
    ];
    for (const table of remapTables) {
      await client.query(
        `UPDATE ${table} SET portal = 'luyenthi' WHERE portal = 'tnjs'`,
      );
      await client.query(
        `UPDATE ${table} SET portal = 'huongnghiep' WHERE portal = 'duhoc'`,
      );
      await client.query(
        `UPDATE ${table} SET portal = 'dichvu' WHERE portal = 'daotao'`,
      );
    }
    await client.query(`
      UPDATE users SET portals = ARRAY(
        SELECT CASE
          WHEN p = 'tnjs' THEN 'luyenthi'
          WHEN p = 'duhoc' THEN 'huongnghiep'
          WHEN p = 'daotao' THEN 'dichvu'
          ELSE p
        END
        FROM unnest(portals) AS p
      )
      WHERE portals IS NOT NULL
    `);
    console.log("ok: remapped legacy portal IDs");

    // Backfill articles from category
    await client.query(`
      UPDATE articles SET portal = 'luyenthi'
      WHERE category = 'japanese-training'
    `);
    await client.query(`
      UPDATE articles SET portal = 'huongnghiep'
      WHERE category IN ('study-abroad', 'visa-services')
    `);
    await client.query(`
      UPDATE articles SET portal = 'dichvu'
      WHERE category = 'soft-skills'
    `);
    await client.query(`
      UPDATE articles SET portal = 'group'
      WHERE category IS NULL OR category = ''
    `);

    await client.query(
      `UPDATE courses SET portal = 'luyenthi' WHERE portal IS NULL OR portal = ''`,
    );
    await client.query(
      `UPDATE class_sessions SET portal = 'luyenthi' WHERE portal IS NULL OR portal = ''`,
    );

    await client.query(`
      UPDATE orders o
      SET portal = cs.portal
      FROM order_items oi
      JOIN class_sessions cs ON cs.id = oi.class_session_id
      WHERE oi.order_id = o.id
    `);

    await client.query(`
      UPDATE site_contents SET portal = 'luyenthi'
      WHERE page IN ('japanese-training', 'japanese', 'tnjs', 'luyenthi')
    `);
    await client.query(`
      UPDATE site_contents SET portal = 'huongnghiep'
      WHERE page IN ('study-abroad', 'duhoc', 'visa', 'huongnghiep')
    `);
    await client.query(`
      UPDATE site_contents SET portal = 'dichvu'
      WHERE page IN ('daotao', 'soft-skills', 'dichvu')
    `);
    await client.query(`
      UPDATE site_contents SET portal = 'group'
      WHERE page IN ('home', 'visa-services') OR portal IS NULL
    `);

    await client.query(`
      UPDATE ui_images SET portal = 'luyenthi'
      WHERE image_type ILIKE '%japanese%'
         OR image_type ILIKE '%jlpt%'
         OR image_type ILIKE '%instructor%'
    `);
    await client.query(`
      UPDATE ui_images SET portal = 'huongnghiep'
      WHERE image_type ILIKE '%study%'
         OR image_type ILIKE '%abroad%'
         OR image_type ILIKE '%visa%'
    `);

    const softCount = await client.query(
      `SELECT count(*)::int AS n FROM articles WHERE category = 'soft-skills' OR portal = 'dichvu'`,
    );
    if ((softCount.rows[0]?.n ?? 0) === 0) {
      await client.query(`
        INSERT INTO articles (title, content, category, portal, sort_order)
        VALUES
        (
          'Khai giảng khóa giao tiếp & thuyết trình',
          $content1$
<p>Dịch vụ N&P mở lớp kỹ năng mềm giúp bạn tự tin giao tiếp, thuyết trình và làm việc nhóm.</p>
<ul>
<li>Sĩ số nhỏ, thực hành nhiều</li>
<li>Lịch tối trong tuần hoặc cuối tuần</li>
<li>Phù hợp sinh viên và người đi làm</li>
</ul>
<p>Liên hệ tư vấn để nhận lịch khai giảng gần nhất.</p>
$content1$,
          'soft-skills',
          'dichvu',
          1
        ),
        (
          'Đào tạo doanh nghiệp: thiết kế theo brief HR',
          $content2$
<p>Chương trình in-house cho doanh nghiệp: kỹ năng mềm, văn hóa làm việc và phát triển đội ngũ.</p>
<ul>
<li>Onsite, hybrid hoặc online</li>
<li>Báo cáo tham dự và đánh giá sau khóa</li>
<li>Có thể kết hợp tiếng Nhật doanh nghiệp qua TNJS (tnjs.vn)</li>
</ul>
$content2$,
          'soft-skills',
          'dichvu',
          2
        )
      `);
      console.log("ok: seeded 2 soft-skills / dichvu articles");
    } else {
      console.log("skip seed soft-skills: already have", softCount.rows[0].n);
    }

    await client.query("COMMIT");

    const counts = await client.query(`
      SELECT 'articles' AS t, portal, count(*)::int AS n FROM articles GROUP BY portal
      UNION ALL
      SELECT 'ui_images', portal, count(*)::int FROM ui_images GROUP BY portal
      UNION ALL
      SELECT 'testimonials', portal, count(*)::int FROM testimonials GROUP BY portal
      UNION ALL
      SELECT 'site_contents', portal, count(*)::int FROM site_contents GROUP BY portal
      UNION ALL
      SELECT 'courses', portal, count(*)::int FROM courses GROUP BY portal
      ORDER BY 1, 2
    `);
    console.log("portal counts:");
    for (const row of counts.rows) {
      console.log(`  ${row.t} / ${row.portal}: ${row.n}`);
    }
    console.log("ensurePortalColumns done");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
