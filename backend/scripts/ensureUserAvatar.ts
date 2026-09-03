/**
 * Add users.avatar_url for profile avatars.
 * Run: npx tsx scripts/ensureUserAvatar.ts
 */
import "dotenv/config";
import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`,
    );
    await client.query("COMMIT");
    console.log("ok: users.avatar_url column");
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
