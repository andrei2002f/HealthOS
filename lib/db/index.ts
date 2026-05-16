import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Postgres connection to Supabase. `prepare: false` keeps it compatible with
 * Supabase's transaction-mode connection pooler (pgbouncer).
 */
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

export type Database = typeof db;
