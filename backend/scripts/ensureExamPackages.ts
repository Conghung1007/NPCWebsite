/**
 * Ensure exam packages catalog + package columns.
 * Run: npx tsx scripts/ensureExamPackages.ts
 */
import "dotenv/config";
import { pool } from "../db";
import { ensureDefaultExamPackages } from "../examEntitlements";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `ALTER TABLE exams ADD COLUMN IF NOT EXISTS level text`,
    );
    await client.query(
      `ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_level_trial boolean NOT NULL DEFAULT false`,
    );
    await client.query(
      `ALTER TABLE exams ADD COLUMN IF NOT EXISTS package_id text`,
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_packages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        level text,
        exam_count integer NOT NULL DEFAULT 1,
        price_vnd integer NOT NULL DEFAULT 10000,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_level_entitlements (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        level text NOT NULL DEFAULT '',
        package_id text,
        status text NOT NULL DEFAULT 'pending',
        amount_vnd integer NOT NULL DEFAULT 10000,
        note text,
        created_at timestamp NOT NULL DEFAULT now(),
        reviewed_at timestamp,
        reviewed_by varchar
      )
    `);
    await client.query(
      `ALTER TABLE exam_level_entitlements ADD COLUMN IF NOT EXISTS package_id text`,
    );
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS exam_level_entitlements_user_level_idx
      ON exam_level_entitlements (user_id, level)
    `);

    await client.query(
      `ALTER TABLE exam_packages ADD COLUMN IF NOT EXISTS compare_at_price_vnd integer`,
    );

    await client.query("COMMIT");
    console.log("columns/tables ok");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await ensureDefaultExamPackages();
  console.log("ensureExamPackages done");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
