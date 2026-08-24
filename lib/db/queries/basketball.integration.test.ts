import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createTestUser } from "@/lib/db/__test__/helpers";
import { basketballSessions } from "@/lib/db/schema";
import { workoutFixture } from "@/lib/whoop/__test__/fixtures";

import { autoCreateBasketballSessions } from "./basketball";
import { upsertWorkout } from "./whoop";

/**
 * Basketball sessions are materialised from Whoop workouts, and the function
 * that does it runs on every sync AND on every page load of /basketball. It has
 * no unique constraint behind it — it relies entirely on a LEFT JOIN finding no
 * existing link. That makes duplicate-prevention a property of the query, which
 * is exactly the kind of thing only a real database can confirm.
 */

let userId: string;

beforeEach(async () => {
  userId = await createTestUser();
});

const BASKETBALL = 17;
const WEIGHTLIFTING = 45;

describe("autoCreateBasketballSessions", () => {
  it("materialises a session from a basketball workout", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: BASKETBALL }),
    );

    expect(await autoCreateBasketballSessions(userId)).toBe(1);

    const [session] = await db.select().from(basketballSessions);
    expect(session.whoopWorkoutId).toBe("1");
  });

  /**
   * The important one: the function is called from a page render, so a user
   * refreshing /basketball three times must not end up with three sessions.
   */
  it("creates nothing on a second run", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: BASKETBALL }),
    );

    expect(await autoCreateBasketballSessions(userId)).toBe(1);
    expect(await autoCreateBasketballSessions(userId)).toBe(0);
    expect(await autoCreateBasketballSessions(userId)).toBe(0);

    expect(await db.select().from(basketballSessions)).toHaveLength(1);
  });

  it("ignores workouts of other sports", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: WEIGHTLIFTING }),
    );

    expect(await autoCreateBasketballSessions(userId)).toBe(0);
    expect(await db.select().from(basketballSessions)).toHaveLength(0);
  });

  it("derives minutes played from the workout's duration", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({
        id: 1,
        sport_id: BASKETBALL,
        start: "2026-08-01T17:00:00.000Z",
        end: "2026-08-01T18:30:00.000Z",
      }),
    );

    await autoCreateBasketballSessions(userId);

    const [session] = await db.select().from(basketballSessions);
    expect(session.minutesPlayed).toBe(90);
  });

  it("leaves minutes null for a workout that has not ended", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: BASKETBALL, end: null }),
    );

    await autoCreateBasketballSessions(userId);

    const [session] = await db.select().from(basketballSessions);
    expect(session.minutesPlayed).toBeNull();
  });

  it("picks up a new workout without touching the existing session", async () => {
    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: BASKETBALL }),
    );
    await autoCreateBasketballSessions(userId);

    await upsertWorkout(
      userId,
      workoutFixture({
        id: 2,
        sport_id: BASKETBALL,
        start: "2026-08-03T17:00:00.000Z",
        end: "2026-08-03T18:00:00.000Z",
      }),
    );

    expect(await autoCreateBasketballSessions(userId)).toBe(1);
    expect(await db.select().from(basketballSessions)).toHaveLength(2);
  });

  it("does not materialise another user's workouts", async () => {
    const other = await createTestUser();
    await upsertWorkout(other, workoutFixture({ id: 1, sport_id: BASKETBALL }));

    expect(await autoCreateBasketballSessions(userId)).toBe(0);
  });

  /**
   * A workout relabelled by a corrected sport map must still be picked up — the
   * Basketball 17-vs-35 fix left already-synced rows named `sport_35` until a
   * re-sync corrected them, and only then should a session appear.
   */
  it("materialises a workout that was relabelled to Basketball later", async () => {
    await upsertWorkout(userId, workoutFixture({ id: 1, sport_id: 999 }));
    expect(await autoCreateBasketballSessions(userId)).toBe(0);

    await upsertWorkout(
      userId,
      workoutFixture({ id: 1, sport_id: BASKETBALL }),
    );

    expect(await autoCreateBasketballSessions(userId)).toBe(1);
  });
});
