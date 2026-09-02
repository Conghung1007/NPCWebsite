/**
 * Ensure page_layouts table exists.
 * Run: npx tsx scripts/ensurePageLayouts.ts
 */
import "dotenv/config";
import { ensurePageLayoutsTable } from "../pageLayouts";
import { pool } from "../db";

async function main() {
  await ensurePageLayoutsTable();
  console.log("ensurePageLayouts done");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
