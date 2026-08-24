import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";

/**
 * The migration chain is applied from empty in global setup, so simply reaching
 * this file proves it replays — the check that was missing when migration 0001
 * shipped with its foreign keys retyped in the wrong order.
 *
 * What follows asserts the schema those migrations are supposed to produce.
 * These are contract tests over DDL: they fail when a migration changes the
 * shape of the database in a way nobody intended.
 */

async function rows<T extends Record<string, unknown>>(
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}

describe("migration chain", () => {
  it("records every migration in the journal as applied", async () => {
    const applied = await rows<{ count: string }>(
      sql`select count(*)::text as count from drizzle.__drizzle_migrations`,
    );

    expect(Number(applied[0].count)).toBe(4);
  });

  it("creates every table the application queries", async () => {
    const found = await rows<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    const names = found.map((r) => r.tablename).sort();

    expect(names).toEqual(
      [
        "ai_insights",
        "basketball_sessions",
        "coach_messages",
        "daily_checkins",
        "exercises",
        "personal_records",
        "strength_sessions",
        "strength_sets",
        "supplement_experiments",
        "supplement_intakes",
        "supplement_schedules",
        "supplements",
        "sync_logs",
        "todos",
        "weekly_reviews",
        "whoop_credentials",
        "whoop_cycles",
        "whoop_recovery",
        "whoop_sleep",
        "whoop_workouts",
      ].sort(),
    );
  });

  /**
   * Migration 0001 retypes the Whoop identifiers from uuid to text, because
   * Whoop v2 returns integers. This is the assertion that would have failed
   * before that migration was repaired — the chain could not reach this state
   * from an empty database at all.
   */
  it("stores Whoop identifiers as text, not uuid", async () => {
    const found = await rows<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(sql`
      select table_name, column_name, data_type
        from information_schema.columns
       where table_schema = 'public'
         and (
           (table_name like 'whoop_%' and column_name in ('id', 'cycle_id', 'sleep_id'))
           or column_name = 'whoop_workout_id'
         )
       order by table_name, column_name
    `);

    expect(found.length).toBeGreaterThan(0);

    for (const column of found) {
      expect(
        `${column.table_name}.${column.column_name} = ${column.data_type}`,
      ).toBe(`${column.table_name}.${column.column_name} = text`);
    }
  });

  /**
   * The four keys migration 0001 has to drop and recreate. If a future edit
   * drops them and forgets to put them back, the chain still applies cleanly
   * and nothing else would notice.
   */
  it("keeps the foreign keys that migration 0001 rebuilds", async () => {
    const found = await rows<{ constraint_name: string }>(sql`
      select tc.constraint_name
        from information_schema.table_constraints tc
       where tc.constraint_type = 'FOREIGN KEY'
         and tc.table_schema = 'public'
         and tc.constraint_name in (
           'basketball_sessions_whoop_workout_id_whoop_workouts_id_fk',
           'strength_sessions_whoop_workout_id_whoop_workouts_id_fk',
           'whoop_recovery_cycle_id_whoop_cycles_id_fk',
           'whoop_sleep_cycle_id_whoop_cycles_id_fk'
         )
    `);

    expect(found.map((r) => r.constraint_name).sort()).toEqual([
      "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk",
      "strength_sessions_whoop_workout_id_whoop_workouts_id_fk",
      "whoop_recovery_cycle_id_whoop_cycles_id_fk",
      "whoop_sleep_cycle_id_whoop_cycles_id_fk",
    ]);
  });

  it("enables row-level security on every table", async () => {
    const unprotected = await rows<{ tablename: string }>(sql`
      select c.relname as tablename
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and c.relrowsecurity = false
    `);

    expect(unprotected.map((r) => r.tablename)).toEqual([]);
  });
});
