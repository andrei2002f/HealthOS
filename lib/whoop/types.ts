// Whoop v2 API response shapes.
// Base URL: https://api.prod.whoop.com/v2

export type WhoopPagedResponse<T> = {
  records: T[];
  next_token: string | null;
};

export type WhoopTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
  refresh_token: string;
  scope: string;
};

export type WhoopCycle = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  } | null;
};

export type WhoopRecovery = {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  } | null;
};

export type WhoopSleep = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  nap: boolean;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
    };
    sleep_performance_percentage: number;
    sleep_efficiency_percentage: number;
    respiratory_rate: number;
  } | null;
};

export type WhoopWorkout = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  sport_id: number;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter: number | null;
    altitude_gain_meter: number | null;
    altitude_change_meter: number | null;
    zone_duration: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  } | null;
};

// Sport ID → human-readable name.
// Full list at https://developer.whoop.com/api — unknowns fall back to `sport_${id}`.
export const SPORT_ID_MAP: Record<number, string> = {
  0: "Activity",
  1: "Cycling",
  16: "Running",
  35: "Basketball",
  44: "Weightlifting",
  45: "Soccer",
  63: "Swimming",
  70: "Functional Fitness",
  125: "HIIT",
};

export function sportName(sportId: number): string {
  return SPORT_ID_MAP[sportId] ?? `sport_${sportId}`;
}
