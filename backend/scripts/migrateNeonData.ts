/**
 * Copy data OLD_DATABASE_URL → DATABASE_URL with correct jsonb casting.
 */
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const NEW_URL = process.env.DATABASE_URL!;
const OLD_URL = process.env.OLD_DATABASE_URL!;

const TABLE_ORDER = [
  "users",
  "contact_info",
  "contact_requests",
  "registration_requests",
  "ui_images",
  "testimonials",
  "site_contents",
  "articles",
  "exams",
  "questions",
  "exam_questions",
  "exam_attempts",
  "courses",
  "class_sessions",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "enrollments",
];

function q(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function listTables(pool: Pool) {
  const r = await pool.query(
    `select table_name from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE'`,
  );
  return new Set(r.rows.map((x: any) => x.table_name as string));
}

async function getColumns(pool: Pool, table: string) {
  const r = await pool.query(
    `select column_name, udt_name, data_type
     from information_schema.columns
     where table_schema='public' and table_name=$1
     order by ordinal_position`,
    [table],
  );
  return r.rows.map((x: any) => ({
    name: x.column_name as string,
    udt: x.udt_name as string,
    dataType: x.data_type as string,
  }));
}

function toJsonParam(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    // Validate / normalize
    try {
      JSON.parse(val);
      return val;
    } catch {
      return JSON.stringify(val);
    }
  }
  return JSON.stringify(val);
}

function toParam(val: unknown, udt: string, dataType: string): unknown {
  if (val === null || val === undefined) return null;
  if (udt === "json" || udt === "jsonb") return toJsonParam(val);
  if (dataType === "ARRAY" || udt.startsWith("_")) {
    if (Array.isArray(val)) return val;
    return val;
  }
  // Date objects
  if (val instanceof Date) return val.toISOString();
  return val;
}

async function main() {
  const oldPool = new Pool({ connectionString: OLD_URL });
  const newPool = new Pool({ connectionString: NEW_URL });

  try {
    const oldTables = await listTables(oldPool);
    const newTables = await listTables(newPool);
    const ordered = [
      ...TABLE_ORDER.filter((t) => oldTables.has(t) && newTables.has(t)),
      ...[...oldTables].filter(
        (t) => newTables.has(t) && !TABLE_ORDER.includes(t) && t !== "session",
      ),
    ];

    for (const table of [...ordered].reverse()) {
      await newPool.query(`delete from ${q(table)}`);
    }

    console.log(`Migrating ${ordered.length} tables...`);

    for (const table of ordered) {
      const oldCols = await getColumns(oldPool, table);
      const newCols = await getColumns(newPool, table);
      const newMap = new Map(newCols.map((c) => [c.name, c]));
      const cols = oldCols
        .filter((c) => newMap.has(c.name))
        .map((c) => newMap.get(c.name)!);

      if (!cols.length) {
        console.log(`  ${table}: skip`);
        continue;
      }

      // Fetch jsonb as text to avoid driver parse quirks
      const selectList = cols
        .map((c) =>
          c.udt === "json" || c.udt === "jsonb"
            ? `${q(c.name)}::text as ${q(c.name)}`
            : q(c.name),
        )
        .join(", ");

      const { rows } = await oldPool.query(
        `select ${selectList} from ${q(table)}`,
      );

      if (rows.length === 0) {
        console.log(`  ${table}: 0`);
        continue;
      }

      const colSql = cols.map((c) => q(c.name)).join(", ");
      const castSql = cols
        .map((c, i) => {
          const p = `$${i + 1}`;
          if (c.udt === "json" || c.udt === "jsonb") return `${p}::jsonb`;
          if (c.udt === "numeric") return `${p}::numeric`;
          if (c.udt === "int4") return `${p}::int`;
          if (c.udt === "int8") return `${p}::bigint`;
          if (c.udt === "float8") return `${p}::double precision`;
          if (c.udt === "bool") return `${p}::boolean`;
          if (c.udt === "timestamp") return `${p}::timestamp`;
          if (c.udt === "_text") return `${p}::text[]`;
          return p;
        })
        .join(", ");

      let ok = 0;
      let fail = 0;
      for (const row of rows) {
        const values = cols.map((c) =>
          toParam(row[c.name], c.udt, c.dataType),
        );
        try {
          await newPool.query(
            `insert into ${q(table)} (${colSql}) values (${castSql}) on conflict do nothing`,
            values,
          );
          ok++;
        } catch (e: any) {
          fail++;
          if (fail <= 2) {
            console.warn(`  ${table} fail id=${row.id}: ${e.message}`);
          }
        }
      }
      console.log(`  ${table}: ${ok}` + (fail ? ` (${fail} failed)` : ""));
    }

    console.log("Done.");
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
