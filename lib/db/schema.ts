import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

/**
 * Columns shared by every table. `updated_at` is kept fresh via Drizzle's
 * `$onUpdate` — all writes go through Drizzle (see CLAUDE.md), so a DB trigger
 * is not needed.
 */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** RLS policy: row is owned by the current user via a direct `user_id` column. */
function ownerPolicy(tableName: string) {
  return pgPolicy(`${tableName}_owner`, {
    for: "all",
    to: authenticatedRole,
    using: sql`(select auth.uid()) = user_id`,
    withCheck: sql`(select auth.uid()) = user_id`,
  });
}

// ───────────────────────────── Whoop credentials ─────────────────────────────

export const whoopCredentials = pgTable(
  "whoop_credentials",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scopes: text("scopes").array().notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  () => [
    pgPolicy("whoop_credentials_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),
  ],
);

// ────────────────────────────── Whoop synced data ────────────────────────────

export const whoopCycles = pgTable(
  "whoop_cycles",
  {
    id: uuid("id").primaryKey(), // Whoop v2 UUID
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    strain: numeric("strain"),
    kilojoules: numeric("kilojoules"),
    averageHeartRate: integer("average_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (t) => [
    index("whoop_cycles_user_start_idx").on(t.userId, t.startAt.desc()),
    ownerPolicy("whoop_cycles"),
  ],
);

export const whoopRecovery = pgTable(
  "whoop_recovery",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => whoopCycles.id, {
      onDelete: "set null",
    }),
    sleepId: uuid("sleep_id"),
    recoveryScore: integer("recovery_score"),
    hrvRmssdMs: numeric("hrv_rmssd_ms"),
    restingHeartRate: integer("resting_heart_rate"),
    spo2Percent: numeric("spo2_percent"),
    skinTempCelsius: numeric("skin_temp_celsius"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (t) => [
    index("whoop_recovery_user_scored_idx").on(t.userId, t.scoredAt.desc()),
    ownerPolicy("whoop_recovery"),
  ],
);

export const whoopSleep = pgTable(
  "whoop_sleep",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").references(() => whoopCycles.id, {
      onDelete: "set null",
    }),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    isNap: boolean("is_nap"),
    totalInBedSeconds: integer("total_in_bed_seconds"),
    totalAwakeSeconds: integer("total_awake_seconds"),
    totalLightSeconds: integer("total_light_seconds"),
    totalSwsSeconds: integer("total_sws_seconds"), // deep sleep
    totalRemSeconds: integer("total_rem_seconds"),
    sleepPerformancePercent: integer("sleep_performance_percent"),
    sleepEfficiencyPercent: numeric("sleep_efficiency_percent"),
    respiratoryRate: numeric("respiratory_rate"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (t) => [
    index("whoop_sleep_user_start_idx").on(t.userId, t.startAt.desc()),
    ownerPolicy("whoop_sleep"),
  ],
);

export const whoopWorkouts = pgTable(
  "whoop_workouts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    sportName: text("sport_name"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    strain: numeric("strain"),
    averageHeartRate: integer("average_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    kilojoules: numeric("kilojoules"),
    distanceMeters: numeric("distance_meters"),
    altitudeGainMeters: numeric("altitude_gain_meters"),
    hrZoneDurationsSeconds: jsonb("hr_zone_durations_seconds"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (t) => [
    index("whoop_workouts_user_start_idx").on(t.userId, t.startAt.desc()),
    index("whoop_workouts_sport_idx").on(t.sportName),
    ownerPolicy("whoop_workouts"),
  ],
);

// ───────────────────────────── Strength training ─────────────────────────────

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    primaryMuscle: text("primary_muscle"),
    secondaryMuscles: text("secondary_muscles").array(),
    equipment: text("equipment"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("exercises_user_name_idx").on(t.userId, t.name),
    ownerPolicy("exercises"),
  ],
);

export const strengthSessions = pgTable(
  "strength_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    whoopWorkoutId: uuid("whoop_workout_id").references(() => whoopWorkouts.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("strength_sessions_user_performed_idx").on(
      t.userId,
      t.performedAt.desc(),
    ),
    ownerPolicy("strength_sessions"),
  ],
);

export const strengthSets = pgTable(
  "strength_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => strengthSessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    setIndex: integer("set_index").notNull(),
    reps: integer("reps"),
    weightKg: numeric("weight_kg"),
    rpe: numeric("rpe"),
    isWarmup: boolean("is_warmup").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("strength_sets_session_idx").on(t.sessionId),
    // No direct user_id — ownership is derived from the parent session.
    pgPolicy("strength_sets_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from strength_sessions s where s.id = session_id and s.user_id = (select auth.uid()))`,
      withCheck: sql`exists (select 1 from strength_sessions s where s.id = session_id and s.user_id = (select auth.uid()))`,
    }),
  ],
);

export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // 'e1rm' | 'top_set' | 'volume_session'
    value: numeric("value").notNull(),
    reps: integer("reps"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull(),
    setId: uuid("set_id").references(() => strengthSets.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("personal_records_user_exercise_idx").on(t.userId, t.exerciseId),
    ownerPolicy("personal_records"),
  ],
);

// ──────────────────────────────── Basketball ─────────────────────────────────

export const basketballSessions = pgTable(
  "basketball_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    whoopWorkoutId: uuid("whoop_workout_id").references(() => whoopWorkouts.id, {
      onDelete: "set null",
    }),
    sessionType: text("session_type"), // 'pickup' | 'league' | 'training' | '3v3' | '5v5'
    location: text("location"),
    surface: text("surface"), // 'parquet' | 'outdoor_concrete' | 'synthetic'
    teamScore: integer("team_score"),
    opponentScore: integer("opponent_score"),
    points: integer("points"),
    assists: integer("assists"),
    rebounds: integer("rebounds"),
    steals: integer("steals"),
    blocks: integer("blocks"),
    turnovers: integer("turnovers"),
    minutesPlayed: integer("minutes_played"),
    effortRating: integer("effort_rating"), // 1-10
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("basketball_sessions_user_played_idx").on(
      t.userId,
      t.playedAt.desc(),
    ),
    ownerPolicy("basketball_sessions"),
  ],
);

// ──────────────────────────────── Supplements ────────────────────────────────

export const supplements = pgTable(
  "supplements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultDose: numeric("default_dose"),
    doseUnit: text("dose_unit"), // 'mg' | 'g' | 'iu' | 'ml' | 'capsule'
    category: text("category"),
    costPerServingRon: numeric("cost_per_serving_ron"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  () => [ownerPolicy("supplements")],
);

export const supplementSchedules = pgTable(
  "supplement_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplementId: uuid("supplement_id")
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    timeOfDay: time("time_of_day"),
    daysOfWeek: integer("days_of_week").array(), // 0-6 (Sun-Sat), null = every day
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  () => [
    // Ownership derived from the parent supplement.
    pgPolicy("supplement_schedules_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from supplements s where s.id = supplement_id and s.user_id = (select auth.uid()))`,
      withCheck: sql`exists (select 1 from supplements s where s.id = supplement_id and s.user_id = (select auth.uid()))`,
    }),
  ],
);

export const supplementIntakes = pgTable(
  "supplement_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    supplementId: uuid("supplement_id")
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dose: numeric("dose"),
    skipped: boolean("skipped").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("supplement_intakes_user_taken_idx").on(t.userId, t.takenAt.desc()),
    ownerPolicy("supplement_intakes"),
  ],
);

export const supplementExperiments = pgTable(
  "supplement_experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    supplementId: uuid("supplement_id")
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    hypothesis: text("hypothesis"),
    conclusion: text("conclusion"),
    ...timestamps,
  },
  () => [ownerPolicy("supplement_experiments")],
);

// ─────────────────────────────── Daily check-in ──────────────────────────────

export const dailyCheckins = pgTable(
  "daily_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    checkDate: date("check_date").notNull(),
    mood: integer("mood"), // 1-5
    energy: integer("energy"), // 1-5
    soreness: integer("soreness"), // 1-5
    stress: integer("stress"), // 1-5
    painAreas: text("pain_areas").array(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("daily_checkins_user_date_idx").on(t.userId, t.checkDate),
    ownerPolicy("daily_checkins"),
  ],
);

// ────────────────────────────── AI artifacts ─────────────────────────────────

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(), // ISO week Monday
    contentMd: text("content_md").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("weekly_reviews_user_week_idx").on(t.userId, t.weekStart),
    ownerPolicy("weekly_reviews"),
  ],
);

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    insightType: text("insight_type"), // 'correlation' | 'warning' | 'pr_celebration'
    title: text("title"),
    bodyMd: text("body_md"),
    data: jsonb("data"),
    surfacedAt: timestamp("surfaced_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("ai_insights_user_surfaced_idx").on(t.userId, t.surfacedAt.desc()),
    ownerPolicy("ai_insights"),
  ],
);

// ───────────────────────────────── Sync logs ─────────────────────────────────

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    job: text("job").notNull(), // e.g. 'whoop_sync' | 'refresh_tokens'
    status: text("status").notNull(), // 'success' | 'error' | 'partial'
    recordsSynced: integer("records_synced"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("sync_logs_user_started_idx").on(t.userId, t.startedAt.desc()),
    ownerPolicy("sync_logs"),
  ],
);
