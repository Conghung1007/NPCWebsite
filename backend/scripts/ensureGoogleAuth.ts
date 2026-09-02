/**
 * Add Google OAuth columns to users (google_id, nullable password).
 * Run: npx tsx scripts/ensureGoogleAuth.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text`,
    );
    console.log("ok: users.google_id column");

    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL`,
    );
    console.log("ok: users.google_id unique index");

    await client.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
    console.log("ok: users.password nullable");

    await client.query("COMMIT");
    console.log("ensureGoogleAuth done");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
