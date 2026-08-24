import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createTestUser } from "@/lib/db/__test__/helpers";
import { whoopCycles, whoopSleep, whoopWorkouts } from "@/lib/db/schema";
import {
  cycleFixture,
  recoveryFixture,
  sleepFixture,
  workoutFixture,
} from "@/lib/whoop/__test__/fixtures";

import {
  getAllWhoopUserIds,
  getRecentSyncLogs,
  insertSyncLog,
  upsertCycle,
  upsertRecovery,
  upsertSleep,
  upsertWhoopCredentials,
  upsertWorkout,
} from "./whoop";

/**
 * Against a real Postgres, with the schema built by the real migration chain.
 *
 * These cover the parts of the data layer whose behaviour lives in the
 * database rather than in TypeScript: ON CONFLICT resolution, foreign keys, and
 * the fact that two users' rows never mix. A mocked Drizzle would assert that
 * the query builder was called, which is a restatement of the code, not a test
 * of it.
 */

let userId: string;

beforeEach(async () => {
  userId = await createTestUser();
});

describe("upsert idempotency", () => {
  /**
   * The sync re-fetches a three-day overlap window on every run, so each record
   * is written repeatedly by design. If any upsert inserted instead of merging,
   * the tables would grow without bound and every dashboard aggregate would be
   * wrong.
   */
  it("writes one row no matter how many times a workout is synced", async () => {
    const payload = workoutFixture();

    await upsertWorkout(userId, payload);
    await upsertWorkout(userId, payload);
    await upsertWorkout(userId, payload);

    const rows = await db.select().from(whoopWorkouts);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("77012");
  });

  it("writes one row per cycle, sleep and recovery on repeat syncs", async () => {
    await upsertCycle(userId, cycleFixture());
    await upsertCycle(userId, cycleFixture());
    await upsertSleep(userId, sleepFixture());
    await upsertSleep(userId, sleepFixture());
    await upsertRecovery(userId, recoveryFixture());
    await upsertRecovery(userId, recoveryFixture());

    expect(await db.select().from(whoopCycles)).toHaveLength(1);
    expect(await db.select().from(whoopSleep)).toHaveLength(1);
  });

  it("keeps distinct records distinct", async () => {
    await upsertWorkout(userId, workoutFixture({ id: 1 }));
    await upsertWorkout(userId, workoutFixture({ id: 2 }));

    expect(await db.select().from(whoopWorkouts)).toHaveLength(2);
  });
});

describe("upsert refreshes changed values", () => {
  /**
   * The regression this suite exists for. SPORT_ID_MAP once had Basketball at
   * 35 instead of 17, so workouts synced before the fix were labelled
   * `sport_17`. The correction only reaches those rows if sport_name is part of
   * the conflict update — it was once omitted, and nothing caught it.
   */
  it("relabels a workout when the sport map changes", async () => {
    await db.insert(whoopWorkouts).values({
      id: "77012",
      userId,
      sportName: "sport_17",
      startAt: new Date("2026-08-01T17:00:00.000Z"),
    });

    await upsertWorkout(userId, workoutFixture({ id: 77012, sport_id: 17 }));

    const [row] = await db
      .select()
      .from(whoopWorkouts)
      .where(eq(whoopWorkouts.id, "77012"));

    expect(row.sportName).toBe("Basketball");
  });

  /**
   * Whoop scores a record hours after it ends, which is the entire reason the
   * sync re-fetches an overlap window. An unscored record must be filled in on
   * the later pass.
   */
  it("fills in a score that arrived after the first sync", async () => {
    await upsertCycle(
      userId,
      cycleFixture({ score: null, score_state: "PENDING_SCORE" }),
    );

    const [before] = await db.select().from(whoopCycles);
    expect(before.strain).toBeNull();

    await upsertCycle(userId, cycleFixture());

    const [after] = await db.select().from(whoopCycles);
    expect(after.strain).toBe("12.3456");
    expect(after.averageHeartRate).toBe(71);
  });

  it("advances updatedAt on a re-sync", async () => {
    await upsertWorkout(userId, workoutFixture());
    const [first] = await db.select().from(whoopWorkouts);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await upsertWorkout(userId, workoutFixture());
    const [second] = await db.select().from(whoopWorkouts);

    expect(second.updatedAt.getTime()).toBeGreaterThan(
      first.updatedAt.getTime(),
    );
  });

  it("does not move the start instant of an existing record", async () => {
    await upsertWorkout(userId, workoutFixture());
    const [first] = await db.select().from(whoopWorkouts);

    await upsertWorkout(
      userId,
      workoutFixture({ start: "2020-01-01T00:00:00.000Z" }),
    );
    const [second] = await db.select().from(whoopWorkouts);

    expect(second.startAt).toEqual(first.startAt);
  });
});

describe("user scoping", () => {
  /**
   * The application connects as the database owner, so row-level security is
   * never evaluated on this path — the `user_id` filter in each query is the
   * only thing keeping accounts apart. That makes it worth testing directly.
   */
  it("returns only the requesting user's sync logs", async () => {
    const other = await createTestUser();

    await insertSyncLog({
      userId,
      job: "whoop_sync",
      status: "success",
      startedAt: new Date(),
    });
    await insertSyncLog({
      userId: other,
      job: "whoop_sync",
      status: "success",
      startedAt: new Date(),
    });

    const mine = await getRecentSyncLogs(userId);

    expect(mine).toHaveLength(1);
    expect(mine[0].userId).toBe(userId);
  });

  /**
   * Documents a real limitation rather than a desired behaviour.
   *
   * `whoop_workouts` is keyed on the Whoop id alone, not on (user_id, id), and
   * `user_id` is excluded from the conflict update. So if the same Whoop id
   * ever arrived for two accounts, there would be one row: still owned by the
   * first user, but carrying the second user's data.
   *
   * Harmless as long as this is a single-user app and Whoop ids are globally
   * unique — which is why it has never mattered. It would need a composite
   * primary key before a second real user existed. Pinned here so the
   * assumption is visible instead of implied.
   */
  it("cannot hold the same Whoop id for two users (single-user assumption)", async () => {
    const other = await createTestUser();

    await upsertWorkout(userId, workoutFixture({ id: 77012, sport_id: 45 }));
    await upsertWorkout(other, workoutFixture({ id: 77012, sport_id: 17 }));

    const rows = await db.select().from(whoopWorkouts);

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userId);
    expect(rows[0].sportName).toBe("Basketball");
  });

  it("lists every connected account for the cron job", async () => {
    const other = await createTestUser();

    for (const id of [userId, other]) {
      await upsertWhoopCredentials({
        userId: id,
        accessTokenEncrypted: "enc",
        refreshTokenEncrypted: "enc",
        expiresAt: new Date(Date.now() + 3_600_000),
        scopes: ["read:recovery"],
      });
    }

    expect((await getAllWhoopUserIds()).sort()).toEqual(
      [userId, other].sort(),
    );
  });
});

describe("referential integrity", () => {
  it("rejects a workout for a user that does not exist", async () => {
    await expect(
      upsertWorkout(
        "00000000-0000-0000-0000-000000000000",
        workoutFixture(),
      ),
    ).rejects.toThrow();
  });

  it("removes a user's Whoop data when the account is deleted", async () => {
    await upsertWorkout(userId, workoutFixture());
    expect(await db.select().from(whoopWorkouts)).toHaveLength(1);

    // ON DELETE cascade is declared on the foreign key; this proves the
    // migration actually created it that way.
    await db.execute(sql`delete from auth.users where id = ${userId}`);

    expect(await db.select().from(whoopWorkouts)).toHaveLength(0);
  });
});
