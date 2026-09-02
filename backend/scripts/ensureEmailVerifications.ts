/**
 * Ensure email_verifications table exists.
 * Run: npx tsx scripts/ensureEmailVerifications.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        code text NOT NULL,
        type text NOT NULL,
        expires_at timestamp NOT NULL,
        attempts integer DEFAULT 0,
        is_used boolean DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS email_verifications_email_type_idx
      ON email_verifications (email, type)
    `);
    await client.query("COMMIT");
    console.log("email_verifications table ok");
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
