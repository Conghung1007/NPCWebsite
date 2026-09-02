/**
 * Ensure payment_settings + exam_package_orders tables.
 * Run: npx tsx scripts/ensurePaymentSettings.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        portal text NOT NULL DEFAULT 'luyenthi',
        bank_code text NOT NULL DEFAULT '',
        bank_name text NOT NULL DEFAULT '',
        account_number text NOT NULL DEFAULT '',
        account_name text NOT NULL DEFAULT '',
        transfer_template text NOT NULL DEFAULT 'LT {level} {username}',
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_portal_idx
      ON payment_settings (portal)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_package_orders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        payos_order_code integer NOT NULL UNIQUE,
        user_id varchar NOT NULL,
        package_id varchar NOT NULL,
        amount_vnd integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        payment_link_id text,
        checkout_url text,
        entitlement_id varchar,
        expires_at timestamp,
        paid_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query("COMMIT");
    console.log("payment tables ok");
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
