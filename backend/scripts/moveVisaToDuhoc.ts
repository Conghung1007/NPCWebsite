/**
 * One-off: move visa content from group → duhoc portal.
 * Run: npx tsx scripts/moveVisaToDuhoc.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const articles = await client.query(`
      UPDATE articles SET portal = 'duhoc'
      WHERE category = 'visa-services'
      RETURNING id
    `);
    console.log(`articles → duhoc: ${articles.rowCount}`);

    // Avoid unique (page,key,portal) conflicts: delete empty duhoc visa rows first if any,
    // then move group visa contents.
    await client.query(`
      DELETE FROM site_contents
      WHERE page = 'visa' AND portal = 'duhoc'
        AND key IN (
          SELECT key FROM site_contents WHERE page = 'visa' AND portal = 'group'
        )
    `);
    const contents = await client.query(`
      UPDATE site_contents SET portal = 'duhoc'
      WHERE page = 'visa' AND portal = 'group'
      RETURNING id
    `);
    console.log(`site_contents visa → duhoc: ${contents.rowCount}`);

    const images = await client.query(`
      UPDATE ui_images SET portal = 'duhoc'
      WHERE portal = 'group'
        AND (
          image_type ILIKE '%visa%'
        )
      RETURNING id, image_type
    `);
    console.log(`ui_images visa → duhoc: ${images.rowCount}`);
    for (const row of images.rows) {
      console.log(`  ${row.image_type}`);
    }

    await client.query("COMMIT");
    console.log("moveVisaToDuhoc done");
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
