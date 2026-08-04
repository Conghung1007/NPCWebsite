import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const NEW_URL = process.env.DATABASE_URL!;
const OLD_URL = process.env.OLD_DATABASE_URL;

async function counts(url: string, label: string) {
  const pool = new Pool({ connectionString: url });
  try {
    const tables = [
      "users",
      "articles",
      "exams",
      "questions",
      "exam_attempts",
      "courses",
      "orders",
      "testimonials",
      "contact_requests",
      "registration_requests",
      "site_contents",
      "contact_info",
      "ui_images",
    ];
    console.log(`\n=== ${label} ===`);
    for (const t of tables) {
      try {
        const r = await pool.query(`select count(*)::int as c from ${t}`);
        console.log(`${t}: ${r.rows[0].c}`);
      } catch {
        console.log(`${t}: (missing)`);
      }
    }
  } finally {
    await pool.end();
  }
}

await counts(NEW_URL, "NEW (current DATABASE_URL)");
if (OLD_URL) {
  await counts(OLD_URL, "OLD");
} else {
  console.log("\nOLD_DATABASE_URL not set — skip old counts");
}
