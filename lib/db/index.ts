import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  // `prepare: false` keeps it compatible with Supabase's transaction-mode
  // connection pooler (pgbouncer).
  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

function getDb(): Db {
  return (cached ??= createDb());
}

/**
 * Postgres connection to Supabase.
 *
 * Built on first use rather than at import. `next build` loads every route
 * module to collect page data, so constructing the pool here at import time
 * would read DATABASE_URL — and therefore require a real database — during the
 * build. The Proxy keeps the `db.select(...)` call sites unchanged across the
 * ~10 modules that import it.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop) as unknown;
    // Drizzle's query builders are methods; they need their receiver.
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Database = Db;
