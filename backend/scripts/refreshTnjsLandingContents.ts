/**
 * Clear stale japanese CMS keys so TNJS landing defaults apply.
 * Run: npx tsx scripts/refreshTnjsLandingContents.ts
 */
import "dotenv/config";
import { pool } from "../db";

/** Exact keys + prefix patterns (ending with -) */
const KEYS = [
  "why-",
  "course-",
  "schedule-",
  "instructor-",
  "process-",
  "method-",
  "courses-title",
  "courses-description",
  "courses-note",
  "stories-title",
  "stories-description",
  "heroTitle",
  "heroDescription",
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clauses = KEYS.map((p, i) =>
      p.endsWith("-") ? `key LIKE $${i + 1}` : `key = $${i + 1}`,
    ).join(" OR ");
    const params = KEYS.map((p) => (p.endsWith("-") ? `${p}%` : p));
    const res = await client.query(
      `DELETE FROM site_contents
       WHERE page IN ('japanese', 'japanese-training')
         AND (${clauses})
       RETURNING key, portal`,
      params,
    );
    await client.query("COMMIT");
    console.log(`Cleared ${res.rowCount} content rows (defaults will show)`);
    for (const row of res.rows.slice(0, 50)) {
      console.log(` - [${row.portal}] ${row.key}`);
    }
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
