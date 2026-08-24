import { describe, expect, it } from "vitest";

import {
  cycleFixture as cycle,
  recoveryFixture as recovery,
  sleepFixture as sleep,
  workoutFixture as workout,
} from "./__test__/fixtures";
import {
  toCycleRow,
  toRecoveryRow,
  toSleepRow,
  toWorkoutRow,
  updateSetFor,
} from "./mappers";

const USER = "11111111-1111-1111-1111-111111111111";

/**
 * Whoop returns `score: null` whenever `score_state` is not "SCORED" — which is
 * the normal state for a cycle still in progress, or a sleep the algorithm has
 * not finished processing. Every mapper has to survive it, and this is the case
 * that was impossible to cover before the transformations were pulled out of
 * the upserts.
 */

describe("toCycleRow", () => {
  it("stringifies the integer id, because the column is text", () => {
    expect(toCycleRow(USER, cycle({ id: 93845 })).id).toBe("93845");
  });

  it("keeps numerics as strings to avoid float precision loss", () => {
    const row = toCycleRow(USER, cycle());

    expect(row.strain).toBe("12.3456");
    expect(row.kilojoules).toBe("8123.4");
  });

  it("nulls every scored field when the cycle is not yet scored", () => {
    const row = toCycleRow(
      USER,
      cycle({ score: null, score_state: "PENDING_SCORE" }),
    );

    expect(row.strain).toBeNull();
    expect(row.kilojoules).toBeNull();
    expect(row.averageHeartRate).toBeNull();
    expect(row.maxHeartRate).toBeNull();
  });

  it("leaves endAt null for a cycle still in progress", () => {
    expect(toCycleRow(USER, cycle({ end: null })).endAt).toBeNull();
  });

  it("preserves the payload verbatim for later backfills", () => {
    const payload = cycle();

    expect(toCycleRow(USER, payload).raw).toEqual(payload);
  });
});

describe("toSleepRow", () => {
  it("converts stage durations from milliseconds to whole seconds", () => {
    const row = toSleepRow(USER, sleep());

    expect(row.totalInBedSeconds).toBe(28_500);
    expect(row.totalAwakeSeconds).toBe(1_500);
    expect(row.totalRemSeconds).toBe(6_000);
  });

  it("rounds rather than truncates sub-second remainders", () => {
    const row = toSleepRow(
      USER,
      sleep({
        score: {
          ...sleep().score!,
          stage_summary: {
            ...sleep().score!.stage_summary,
            total_awake_time_milli: 1_500,
          },
        },
      }),
    );

    expect(row.totalAwakeSeconds).toBe(2);
  });

  it("nulls all stage durations when the sleep is unscored", () => {
    const row = toSleepRow(
      USER,
      sleep({ score: null, score_state: "PENDING_SCORE" }),
    );

    expect(row.totalInBedSeconds).toBeNull();
    expect(row.totalRemSeconds).toBeNull();
    expect(row.sleepPerformancePercent).toBeNull();
    expect(row.respiratoryRate).toBeNull();
  });

  it("carries the nap flag through", () => {
    expect(toSleepRow(USER, sleep({ nap: true })).isNap).toBe(true);
  });
});

describe("toWorkoutRow", () => {
  it("resolves a known sport id to its name", () => {
    expect(toWorkoutRow(USER, workout({ sport_id: 45 })).sportName).toBe(
      "Weightlifting",
    );
    expect(toWorkoutRow(USER, workout({ sport_id: 17 })).sportName).toBe(
      "Basketball",
    );
  });

  it("falls back to a stable label for an unknown sport id", () => {
    expect(toWorkoutRow(USER, workout({ sport_id: 999 })).sportName).toBe(
      "sport_999",
    );
  });

  it("converts heart-rate zone durations to seconds", () => {
    expect(toWorkoutRow(USER, workout()).hrZoneDurationsSeconds).toEqual({
      z0: 60,
      z1: 120,
      z2: 300,
      z3: 900,
      z4: 240,
      z5: 0,
    });
  });

  it("treats a missing zone_zero_milli as zero rather than NaN", () => {
    const payload = workout();
    // Whoop omits this field on some older records.
    delete (payload.score!.zone_duration as Partial<Record<string, number>>)
      .zone_zero_milli;

    const zones = toWorkoutRow(USER, payload).hrZoneDurationsSeconds as Record<
      string,
      number
    >;

    expect(zones.z0).toBe(0);
    expect(Number.isNaN(zones.z0)).toBe(false);
  });

  it("nulls the zone breakdown entirely when the workout is unscored", () => {
    const row = toWorkoutRow(
      USER,
      workout({ score: null, score_state: "UNSCORABLE" }),
    );

    expect(row.hrZoneDurationsSeconds).toBeNull();
    expect(row.strain).toBeNull();
    expect(row.distanceMeters).toBeNull();
  });

  it("keeps a null distance distinct from a zero distance", () => {
    const withNull = toWorkoutRow(
      USER,
      workout({ score: { ...workout().score!, distance_meter: null } }),
    );
    const withZero = toWorkoutRow(
      USER,
      workout({ score: { ...workout().score!, distance_meter: 0 } }),
    );

    expect(withNull.distanceMeters).toBeNull();
    expect(withZero.distanceMeters).toBe("0");
  });
});

describe("toRecoveryRow", () => {
  it("keys the row on cycle_id, which is recovery's identity in v2", () => {
    const row = toRecoveryRow(USER, recovery({ cycle_id: 93845 }));

    expect(row.id).toBe("93845");
    expect(row.cycleId).toBe("93845");
  });

  it("links the sleep it was derived from", () => {
    expect(toRecoveryRow(USER, recovery({ sleep_id: 55501 })).sleepId).toBe(
      "55501",
    );
  });

  it("nulls the scores while Whoop is still calibrating", () => {
    const row = toRecoveryRow(
      USER,
      recovery({ score: null, score_state: "PENDING_SCORE" }),
    );

    expect(row.recoveryScore).toBeNull();
    expect(row.hrvRmssdMs).toBeNull();
    expect(row.spo2Percent).toBeNull();
  });
});

describe("updateSetFor", () => {
  it("refreshes every column that is not declared immutable", () => {
    const row = toWorkoutRow(USER, workout());
    const set = updateSetFor(row, ["id", "userId", "startAt"] as const);

    expect(set).not.toHaveProperty("id");
    expect(set).not.toHaveProperty("userId");
    expect(set).not.toHaveProperty("startAt");
    expect(set.sportName).toBe("Weightlifting");
    expect(set.endAt).toEqual(row.endAt);
  });

  /**
   * The regression guard for the defect that motivated the extraction: a
   * workout re-synced after SPORT_ID_MAP was corrected must be relabelled, so
   * sportName has to appear in the update.
   */
  it("includes sportName so a corrected sport map relabels existing rows", () => {
    const set = updateSetFor(toWorkoutRow(USER, workout({ sport_id: 17 })), [
      "id",
      "userId",
      "startAt",
    ] as const);

    expect(set.sportName).toBe("Basketball");
  });

  it("stamps updatedAt", () => {
    const set = updateSetFor(toCycleRow(USER, cycle()), ["id"] as const);

    expect(set.updatedAt).toBeInstanceOf(Date);
  });
});
