import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/** Railway internal + localhost: no SSL. Public proxy / Neon: SSL. */
function createPool(connectionString: string) {
  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    /* keep empty */
  }
  const isInternal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".railway.internal");
  const forceSsl =
    process.env.DATABASE_SSL === "1" || process.env.DATABASE_SSL === "true";

  return new Pool({
    connectionString,
    ...(forceSsl || !isInternal
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
}

export const pool = createPool(process.env.DATABASE_URL);
export const db = drizzle({ client: pool, schema });
