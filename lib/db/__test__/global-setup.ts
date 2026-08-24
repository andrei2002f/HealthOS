import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { assertLocalTestDatabase, TEST_DATABASE_URL } from "./database-url";

/**
 * Runs once for the whole integration suite: bootstraps the Supabase stand-in,
 * then applies the migration chain.
 *
 * The schema is built from `drizzle/`, not from `drizzle-kit push`, and that is
 * the point. Production's schema comes from these files, so the tests must run
 * against the same DDL — otherwise they prove nothing about what is deployed.
 * It also means the chain is replayed from empty on every CI run, which is
 * exactly the check that would have caught the foreign-key ordering defect in
 * migration 0001 five months before it was found.
 *
 * The auth shim is applied here rather than relying on Postgres's
 * `/docker-entrypoint-initdb.d` so the suite works against any empty database —
 * including a GitHub Actions service container, which cannot mount init scripts.
 * The shim is idempotent.
 */
export default async function setup() {
  assertLocalTestDatabase(TEST_DATABASE_URL);

  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    const shim = readFileSync(
      resolve(process.cwd(), "docker/postgres-init/00-auth-shim.sql"),
      "utf8",
    );
    await client.unsafe(shim);

    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
