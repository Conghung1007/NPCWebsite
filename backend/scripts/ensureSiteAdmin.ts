/**
 * Site settings, page analytics, contact read status.
 * Run: npx tsx scripts/ensureSiteAdmin.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE contact_requests
      ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false
    `);
    await client.query(`
      ALTER TABLE contact_requests
      ADD COLUMN IF NOT EXISTS read_at timestamp
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        portal text NOT NULL DEFAULT 'group',
        site_name text NOT NULL DEFAULT '',
        hotline text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT '',
        address text NOT NULL DEFAULT '',
        facebook_url text NOT NULL DEFAULT '',
        youtube_url text NOT NULL DEFAULT '',
        zalo_url text NOT NULL DEFAULT '',
        linkedin_url text NOT NULL DEFAULT '',
        tiktok_url text NOT NULL DEFAULT '',
        logo_url text NOT NULL DEFAULT '',
        logo_footer_url text NOT NULL DEFAULT '',
        favicon_url text NOT NULL DEFAULT '',
        privacy_url text NOT NULL DEFAULT '',
        terms_url text NOT NULL DEFAULT '',
        popup_enabled boolean NOT NULL DEFAULT false,
        popup_title text NOT NULL DEFAULT '',
        popup_body text NOT NULL DEFAULT '',
        popup_image_url text NOT NULL DEFAULT '',
        popup_link_url text NOT NULL DEFAULT '',
        popup_delay_ms integer NOT NULL DEFAULT 1500,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS site_settings_portal_idx
      ON site_settings (portal)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_view_daily (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        portal text NOT NULL,
        view_date text NOT NULL,
        views integer NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS page_view_daily_portal_date_idx
      ON page_view_daily (portal, view_date)
    `);

    const portals = ["group", "huongnghiep", "dichvu", "luyenthi"];
    for (const portal of portals) {
      await client.query(
        `INSERT INTO site_settings (portal)
         SELECT $1::text
         WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE portal = $1)`,
        [portal],
      );
    }

    await client.query("COMMIT");
    console.log("site admin tables ok");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
