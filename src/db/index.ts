import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

let _db: DB | null = null;
function getDb(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add the Neon integration in Vercel or set it in .env.local.");
  }
  // Neon in production (serverless HTTP driver). Plain Postgres locally, if you want it.
  if (/neon\.tech/.test(url) || process.env.DB_DRIVER === "neon") {
    _db = drizzleNeon(neon(url), { schema }) as unknown as DB;
  } else {
    _db = drizzlePg(url, { schema }) as unknown as DB;
  }
  return _db;
}

// Lazy so importing this module never fails at build time; only the first query does.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export { schema };
