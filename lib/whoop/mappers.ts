import type {
  whoopCycles,
  whoopRecovery,
  whoopSleep,
  whoopWorkouts,
} from "@/lib/db/schema";

import { sportName } from "./types";
import type { WhoopCycle, WhoopRecovery, WhoopSleep, WhoopWorkout } from "./types";

/**
 * Whoop v2 payloads → database rows.
 *
 * Split out from the upsert functions for two reasons. The obvious one is that
 * pure functions can be unit-tested against odd payloads — missing scores,
 * absent zone durations, unknown sports — which is where this code actually
 * breaks; exercising those through a database would be slow and awkward.
 *
 * The other is that each upsert previously spelled every transformation twice,
 * once in `values` and again in `onConflictDoUpdate.set`. Two copies of the
 * same expression drift: `sport_name` was once missing from the conflict set,
 * so re-syncing never corrected a mislabelled workout. One mapper plus an
 * explicit list of immutable columns removes the second copy entirely.
 */

type CycleRow = typeof whoopCycles.$inferInsert;
type RecoveryRow = typeof whoopRecovery.$inferInsert;
type SleepRow = typeof whoopSleep.$inferInsert;
type WorkoutRow = typeof whoopWorkouts.$inferInsert;

/** Whoop reports durations in milliseconds; the schema stores whole seconds. */
function toSeconds(milli: number): number {
  return Math.round(milli / 1000);
}

/**
 * Numeric columns are declared as Postgres `numeric`, which Drizzle maps to
 * string to avoid float precision loss.
 */
function toNumeric(value: number | null | undefined): string | null {
  return value?.toString() ?? null;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** The payload is kept verbatim so a later schema change can backfill from it. */
function rawOf(payload: unknown): Record<string, unknown> {
  return payload as Record<string, unknown>;
}

export function toCycleRow(userId: string, cycle: WhoopCycle): CycleRow {
  return {
    id: String(cycle.id),
    userId,
    startAt: new Date(cycle.start),
    endAt: toDate(cycle.end),
    strain: toNumeric(cycle.score?.strain),
    kilojoules: toNumeric(cycle.score?.kilojoule),
    averageHeartRate: cycle.score?.average_heart_rate ?? null,
    maxHeartRate: cycle.score?.max_heart_rate ?? null,
    raw: rawOf(cycle),
  };
}

export function toRecoveryRow(
  userId: string,
  recovery: WhoopRecovery,
): RecoveryRow {
  return {
    // Recovery has no id of its own in v2; it is one-per-cycle.
    id: String(recovery.cycle_id),
    userId,
    cycleId: String(recovery.cycle_id),
    sleepId: String(recovery.sleep_id),
    recoveryScore: recovery.score?.recovery_score ?? null,
    hrvRmssdMs: toNumeric(recovery.score?.hrv_rmssd_milli),
    restingHeartRate: recovery.score?.resting_heart_rate ?? null,
    spo2Percent: toNumeric(recovery.score?.spo2_percentage),
    skinTempCelsius: toNumeric(recovery.score?.skin_temp_celsius),
    scoredAt: new Date(recovery.updated_at),
    raw: rawOf(recovery),
  };
}

export function toSleepRow(userId: string, sleep: WhoopSleep): SleepRow {
  const stages = sleep.score?.stage_summary;

  return {
    id: String(sleep.id),
    userId,
    startAt: toDate(sleep.start),
    endAt: toDate(sleep.end),
    isNap: sleep.nap,
    totalInBedSeconds: stages ? toSeconds(stages.total_in_bed_time_milli) : null,
    totalAwakeSeconds: stages ? toSeconds(stages.total_awake_time_milli) : null,
    totalLightSeconds: stages
      ? toSeconds(stages.total_light_sleep_time_milli)
      : null,
    totalSwsSeconds: stages
      ? toSeconds(stages.total_slow_wave_sleep_time_milli)
      : null,
    totalRemSeconds: stages ? toSeconds(stages.total_rem_sleep_time_milli) : null,
    sleepPerformancePercent: sleep.score?.sleep_performance_percentage ?? null,
    sleepEfficiencyPercent: toNumeric(sleep.score?.sleep_efficiency_percentage),
    respiratoryRate: toNumeric(sleep.score?.respiratory_rate),
    raw: rawOf(sleep),
  };
}

export function toWorkoutRow(
  userId: string,
  workout: WhoopWorkout,
): WorkoutRow {
  const score = workout.score;
  const zones = score?.zone_duration;

  return {
    id: String(workout.id),
    userId,
    sportName: sportName(workout.sport_id),
    startAt: toDate(workout.start),
    endAt: toDate(workout.end),
    strain: toNumeric(score?.strain),
    averageHeartRate: score?.average_heart_rate ?? null,
    maxHeartRate: score?.max_heart_rate ?? null,
    kilojoules: toNumeric(score?.kilojoule),
    distanceMeters: toNumeric(score?.distance_meter),
    altitudeGainMeters: toNumeric(score?.altitude_gain_meter),
    hrZoneDurationsSeconds: zones
      ? {
          // `zone_zero_milli` is occasionally absent from the payload.
          z0: toSeconds(zones.zone_zero_milli ?? 0),
          z1: toSeconds(zones.zone_one_milli),
          z2: toSeconds(zones.zone_two_milli),
          z3: toSeconds(zones.zone_three_milli),
          z4: toSeconds(zones.zone_four_milli),
          z5: toSeconds(zones.zone_five_milli),
        }
      : null,
    raw: rawOf(workout),
  };
}

/**
 * Builds the `onConflictDoUpdate` assignment from a mapped row.
 *
 * Everything is refreshed on conflict except the columns named immutable —
 * identifiers and values that cannot change for a given record. Deriving the
 * update from the same row that was inserted is what guarantees the two can no
 * longer disagree.
 */
export function updateSetFor<Row extends Record<string, unknown>>(
  row: Row,
  immutable: readonly (keyof Row)[],
): Partial<Row> & { updatedAt: Date } {
  const set: Partial<Row> = {};

  for (const key of Object.keys(row) as (keyof Row)[]) {
    if (!immutable.includes(key)) {
      set[key] = row[key];
    }
  }

  return { ...set, updatedAt: new Date() };
}
