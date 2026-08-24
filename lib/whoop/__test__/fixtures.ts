import type {
  WhoopCycle,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
} from "../types";

/**
 * Whoop v2 payloads, shaped as the API actually returns them.
 *
 * Each builder takes an override so a test can state only the field it cares
 * about, which keeps the interesting difference visible at the call site
 * instead of buried in forty lines of scaffolding.
 */

export function cycleFixture(overrides: Partial<WhoopCycle> = {}): WhoopCycle {
  return {
    id: 93845,
    user_id: 7,
    created_at: "2026-08-01T04:00:00.000Z",
    updated_at: "2026-08-01T05:00:00.000Z",
    start: "2026-08-01T04:00:00.000Z",
    end: "2026-08-02T04:00:00.000Z",
    timezone_offset: "+03:00",
    score_state: "SCORED",
    score: {
      strain: 12.3456,
      kilojoule: 8123.4,
      average_heart_rate: 71,
      max_heart_rate: 165,
    },
    ...overrides,
  };
}

export function sleepFixture(overrides: Partial<WhoopSleep> = {}): WhoopSleep {
  return {
    id: 55501,
    user_id: 7,
    created_at: "2026-08-01T06:00:00.000Z",
    updated_at: "2026-08-01T07:00:00.000Z",
    start: "2026-07-31T22:10:00.000Z",
    end: "2026-08-01T06:05:00.000Z",
    timezone_offset: "+03:00",
    nap: false,
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_in_bed_time_milli: 28_500_000,
        total_awake_time_milli: 1_500_000,
        total_light_sleep_time_milli: 14_000_000,
        total_slow_wave_sleep_time_milli: 7_000_000,
        total_rem_sleep_time_milli: 6_000_000,
      },
      sleep_performance_percentage: 88,
      sleep_efficiency_percentage: 94.5,
      respiratory_rate: 14.2,
    },
    ...overrides,
  };
}

export function workoutFixture(
  overrides: Partial<WhoopWorkout> = {},
): WhoopWorkout {
  return {
    id: 77012,
    user_id: 7,
    created_at: "2026-08-01T18:00:00.000Z",
    updated_at: "2026-08-01T18:30:00.000Z",
    start: "2026-08-01T17:00:00.000Z",
    end: "2026-08-01T18:00:00.000Z",
    timezone_offset: "+03:00",
    sport_id: 45,
    score_state: "SCORED",
    score: {
      strain: 9.87,
      average_heart_rate: 120,
      max_heart_rate: 178,
      kilojoule: 1500.5,
      percent_recorded: 100,
      distance_meter: 3200.25,
      altitude_gain_meter: 12.5,
      altitude_change_meter: 0,
      zone_duration: {
        zone_zero_milli: 60_000,
        zone_one_milli: 120_000,
        zone_two_milli: 300_000,
        zone_three_milli: 900_000,
        zone_four_milli: 240_000,
        zone_five_milli: 0,
      },
    },
    ...overrides,
  };
}

export function recoveryFixture(
  overrides: Partial<WhoopRecovery> = {},
): WhoopRecovery {
  return {
    cycle_id: 93845,
    sleep_id: 55501,
    user_id: 7,
    created_at: "2026-08-01T06:30:00.000Z",
    updated_at: "2026-08-01T07:15:00.000Z",
    score_state: "SCORED",
    score: {
      user_calibrating: false,
      recovery_score: 62,
      resting_heart_rate: 52,
      hrv_rmssd_milli: 78.4,
      spo2_percentage: 96.5,
      skin_temp_celsius: 33.2,
    },
    ...overrides,
  };
}
