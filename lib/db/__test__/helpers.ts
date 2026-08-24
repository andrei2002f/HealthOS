import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

/**
 * Empties every application table, plus the auth stand-in.
 *
 * Built dynamically from `pg_tables` rather than from a hand-maintained list,
 * so a new table added to the schema cannot silently start leaking rows between
 * tests. `drizzle.__drizzle_migrations` lives in its own schema and is left
 * alone — the chain is applied once, in global setup.
 */
export async function truncateAll(): Promise<void> {
  // TRUNCATE ... CASCADE emits a NOTICE per cascaded table, which buries the
  // test output under twenty lines of noise on every single test.
  await db.execute(sql`set client_min_messages = warning`);

  await db.execute(sql`
    do $$
    declare
      stmt text;
    begin
      select 'truncate table '
             || string_agg(format('%I.%I', schemaname, tablename), ', ')
             || ' restart identity cascade'
        into stmt
        from pg_tables
       where schemaname = 'public';

      if stmt is not null then
        execute stmt;
      end if;

      truncate table auth.users cascade;
    end
    $$;
  `);
}

/**
 * Inserts a row into the auth stand-in and returns its id.
 *
 * Every application table foreign-keys `auth.users(id)`, so a test that writes
 * user-owned data needs one of these first. In production GoTrue creates it.
 */
export async function createTestUser(email?: string): Promise<string> {
  const id = randomUUID();
  const address = email ?? `${id}@example.test`;

  await db.execute(
    sql`insert into auth.users (id, email) values (${id}, ${address})`,
  );

  return id;
}
