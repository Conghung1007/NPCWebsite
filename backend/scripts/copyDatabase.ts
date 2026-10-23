/**
 * Copy the `public` schema (tables, constraints, indexes, rows) from one Postgres to another.
 * Works across major versions (e.g. Railway PG18 → Neon PG17), where pg_dump refuses.
 *
 * Usage (from backend/):
 *   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/copyDatabase.ts         # dry run
 *   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/copyDatabase.ts --yes   # drop target public tables, copy
 *   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/copyDatabase.ts --merge # only insert rows missing on target (by PK)
 */
import pg from "pg";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
const MERGE = process.argv.includes("--merge");
const APPLY = process.argv.includes("--yes") || MERGE;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("Need SOURCE_DATABASE_URL and TARGET_DATABASE_URL");
  process.exit(1);
}
if (SOURCE_URL === TARGET_URL) {
  console.error("Source and target are the same database");
  process.exit(1);
}

/** Keep every value in Postgres text form so it round-trips exactly (json, arrays, timestamps, numeric). */
const rawTypes = { getTypeParser: () => (value: string) => value };

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function connect(url: string) {
  const host = hostOf(url);
  const internal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".railway.internal");
  const client = new pg.Client({
    connectionString: url,
    ssl: internal ? undefined : { rejectUnauthorized: false },
    types: rawTypes as any,
  });
  await client.connect();
  return client;
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

type Column = {
  name: string;
  type: string;
  notNull: boolean;
  def: string | null;
  identity: string;
  generated: string;
};

type TableDef = {
  oid: string;
  name: string;
  columns: Column[];
  constraints: { name: string; type: string; def: string }[];
  indexes: string[];
};

async function readSchema(client: pg.Client): Promise<TableDef[]> {
  const unsupported = await client.query(`
    select 'view/matview' as kind, relname as name from pg_class
      where relnamespace = 'public'::regnamespace and relkind in ('v','m')
    union all
    select 'sequence', relname from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'S'
    union all
    select 'enum/type', typname from pg_type
      where typnamespace = 'public'::regnamespace and typtype in ('e','d','c')
        and typrelid = 0
    union all
    select 'function', proname from pg_proc where pronamespace = 'public'::regnamespace
    union all
    select 'trigger', tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  `);
  if (unsupported.rows.length) {
    throw new Error(
      "Source has objects this script does not copy: " +
        unsupported.rows.map((r) => `${r.kind}:${r.name}`).join(", "),
    );
  }

  const tables = await client.query(`
    select oid::text as oid, relname as name from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r','p')
    order by relname
  `);

  const out: TableDef[] = [];
  for (const t of tables.rows) {
    const cols = await client.query(
      `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
              a.attnotnull as notnull, pg_get_expr(d.adbin, d.adrelid) as def,
              a.attidentity as identity, a.attgenerated as generated
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = $1::oid and a.attnum > 0 and not a.attisdropped
       order by a.attnum`,
      [t.oid],
    );
    const columns: Column[] = cols.rows.map((c) => ({
      name: c.name,
      type: c.type,
      notNull: c.notnull === "t",
      def: c.def,
      identity: c.identity || "",
      generated: c.generated || "",
    }));
    const special = columns.filter((c) => c.identity || c.generated);
    if (special.length) {
      throw new Error(
        `${t.name}: identity/generated columns not supported (${special.map((c) => c.name).join(", ")})`,
      );
    }

    // contype 'n' (PG18 not-null constraints) is covered by attnotnull
    const cons = await client.query(
      `select conname as name, contype as type, pg_get_constraintdef(oid) as def
       from pg_constraint
       where conrelid = $1::oid and contype in ('p','u','c','f','x')
       order by contype = 'f', conname`,
      [t.oid],
    );
    const idx = await client.query(
      `select pg_get_indexdef(i.indexrelid) as def
       from pg_index i
       where i.indrelid = $1::oid
         and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
       order by i.indexrelid::regclass::text`,
      [t.oid],
    );

    out.push({
      oid: t.oid,
      name: t.name,
      columns,
      constraints: cons.rows,
      indexes: idx.rows.map((r) => r.def),
    });
  }
  return out;
}

function createTableSql(t: TableDef) {
  const cols = t.columns.map((c) => {
    let line = `${q(c.name)} ${c.type}`;
    if (c.def != null) line += ` DEFAULT ${c.def}`;
    if (c.notNull) line += " NOT NULL";
    return line;
  });
  const cons = t.constraints
    .filter((c) => c.type !== "f")
    .map((c) => `CONSTRAINT ${q(c.name)} ${c.def}`);
  return `CREATE TABLE public.${q(t.name)} (\n  ${[...cols, ...cons].join(",\n  ")}\n)`;
}

async function countRows(client: pg.Client, table: string) {
  const r = await client.query(`select count(*)::text as c from public.${q(table)}`);
  return Number(r.rows[0].c);
}

/** Insert source rows whose primary key is absent on target; never updates or deletes. */
async function mergeMissingRows(source: pg.Client, target: pg.Client, schema: TableDef[]) {
  await target.query("begin");
  for (const t of schema) {
    if (!t.constraints.some((c) => c.type === "p")) {
      console.log(`  skip ${t.name}: no primary key`);
      continue;
    }
    const names = t.columns.map((c) => c.name);
    const colList = names.map(q).join(", ");
    const rows = await source.query({
      text: `select ${colList} from public.${q(t.name)}`,
      rowMode: "array",
    });
    const batchSize = Math.max(1, Math.min(500, Math.floor(30000 / names.length)));
    let inserted = 0;
    for (let i = 0; i < rows.rows.length; i += batchSize) {
      const chunk = rows.rows.slice(i, i + batchSize) as unknown[][];
      const params: unknown[] = [];
      const tuples = chunk.map((row) => {
        const ph = row.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        return `(${ph.join(", ")})`;
      });
      const r = await target.query(
        `insert into public.${q(t.name)} (${colList}) values ${tuples.join(", ")} on conflict do nothing`,
        params,
      );
      inserted += r.rowCount ?? 0;
    }
    if (inserted) console.log(`  ${t.name}: +${inserted} missing rows`);
  }
  await target.query("commit");
  console.log("\nMerge complete.");
}

async function main() {
  const source = await connect(SOURCE_URL!);
  const target = await connect(TARGET_URL!);
  console.log(
    `source=${hostOf(SOURCE_URL!)} target=${hostOf(TARGET_URL!)} apply=${APPLY} merge=${MERGE}`,
  );

  try {
    await source.query("begin isolation level repeatable read read only");
    const schema = await readSchema(source);

    if (MERGE) {
      await mergeMissingRows(source, target, schema);
      return;
    }

    const targetTables = await target.query(`
      select relname as name from pg_class
      where relnamespace = 'public'::regnamespace and relkind in ('r','p')
      order by relname
    `);

    console.log(`\nSource tables (${schema.length}):`);
    for (const t of schema) {
      console.log(
        `  ${t.name}: ${await countRows(source, t.name)} rows, ${t.columns.length} cols, ` +
          `${t.constraints.length} constraints, ${t.indexes.length} extra indexes`,
      );
    }
    console.log(
      `\nTarget tables to DROP (${targetTables.rows.length}): ${targetTables.rows.map((r) => r.name).join(", ") || "(none)"}`,
    );

    if (!APPLY) {
      console.log("\nDry run only. Re-run with --yes (full replace) or --merge to apply.");
      return;
    }

    await target.query("begin");
    for (const r of targetTables.rows) {
      await target.query(`drop table if exists public.${q(r.name)} cascade`);
    }
    for (const t of schema) {
      await target.query(createTableSql(t));
    }

    for (const t of schema) {
      const names = t.columns.map((c) => c.name);
      const colList = names.map(q).join(", ");
      const batchSize = Math.max(1, Math.min(500, Math.floor(30000 / names.length)));
      const rows = await source.query({
        text: `select ${colList} from public.${q(t.name)}`,
        rowMode: "array",
      });
      for (let i = 0; i < rows.rows.length; i += batchSize) {
        const chunk = rows.rows.slice(i, i + batchSize) as unknown[][];
        const params: unknown[] = [];
        const tuples = chunk.map((row) => {
          const ph = row.map((v) => {
            params.push(v);
            return `$${params.length}`;
          });
          return `(${ph.join(", ")})`;
        });
        await target.query(
          `insert into public.${q(t.name)} (${colList}) values ${tuples.join(", ")}`,
          params,
        );
      }
      console.log(`  copied ${t.name}: ${rows.rows.length}`);
    }

    for (const t of schema) {
      for (const def of t.indexes) await target.query(def);
      for (const c of t.constraints.filter((c) => c.type === "f")) {
        await target.query(
          `alter table public.${q(t.name)} add constraint ${q(c.name)} ${c.def}`,
        );
      }
    }
    await target.query("commit");

    console.log("\nVerify row counts:");
    let mismatches = 0;
    for (const t of schema) {
      const s = await countRows(source, t.name);
      const d = await countRows(target, t.name);
      if (s !== d) mismatches++;
      console.log(`  ${s === d ? "OK  " : "DIFF"} ${t.name}: source=${s} target=${d}`);
    }
    if (mismatches) {
      throw new Error(`${mismatches} table(s) have mismatched row counts`);
    }
    console.log("\nCopy complete.");
  } catch (err) {
    await target.query("rollback").catch(() => {});
    throw err;
  } finally {
    await source.query("rollback").catch(() => {});
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
