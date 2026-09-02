/**
 * Extend cart/order items for exam packages.
 * Run: npx tsx scripts/ensureCartExamPackages.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE cart_items
      ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'class'
    `);
    await client.query(`
      ALTER TABLE cart_items
      ADD COLUMN IF NOT EXISTS package_id varchar
    `);
    await client.query(`
      ALTER TABLE cart_items
      ALTER COLUMN class_session_id DROP NOT NULL
    `);

    await client.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'class'
    `);
    await client.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS package_id varchar
    `);
    await client.query(`
      ALTER TABLE order_items
      ALTER COLUMN class_session_id DROP NOT NULL
    `);

    await client.query(`DROP INDEX IF EXISTS cart_items_cart_class_idx`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_class_idx
      ON cart_items (cart_id, class_session_id)
      WHERE class_session_id IS NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_package_idx
      ON cart_items (cart_id, package_id)
      WHERE package_id IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("cart exam package columns ok");
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
