CREATE TABLE "ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_type" text,
	"title" text,
	"body_md" text,
	"data" jsonb,
	"surfaced_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "basketball_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"whoop_workout_id" uuid,
	"session_type" text,
	"location" text,
	"surface" text,
	"team_score" integer,
	"opponent_score" integer,
	"points" integer,
	"assists" integer,
	"rebounds" integer,
	"steals" integer,
	"blocks" integer,
	"turnovers" integer,
	"minutes_played" integer,
	"effort_rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basketball_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "daily_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"mood" integer,
	"energy" integer,
	"soreness" integer,
	"stress" integer,
	"pain_areas" text[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"primary_muscle" text,
	"secondary_muscles" text[],
	"equipment" text,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"value" numeric NOT NULL,
	"reps" integer,
	"achieved_at" timestamp with time zone NOT NULL,
	"set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "strength_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"whoop_workout_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strength_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "strength_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid,
	"set_index" integer NOT NULL,
	"reps" integer,
	"weight_kg" numeric,
	"rpe" numeric,
	"is_warmup" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strength_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplement_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"supplement_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"hypothesis" text,
	"conclusion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplement_experiments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplement_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"supplement_id" uuid NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dose" numeric,
	"skipped" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplement_intakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplement_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplement_id" uuid NOT NULL,
	"time_of_day" time,
	"days_of_week" integer[],
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplement_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_dose" numeric,
	"dose_unit" text,
	"category" text,
	"cost_per_serving_ron" numeric,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"records_synced" integer,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"content_md" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whoop_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text[] NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whoop_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whoop_cycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"strain" numeric,
	"kilojoules" numeric,
	"average_heart_rate" integer,
	"max_heart_rate" integer,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whoop_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whoop_recovery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"cycle_id" uuid,
	"sleep_id" uuid,
	"recovery_score" integer,
	"hrv_rmssd_ms" numeric,
	"resting_heart_rate" integer,
	"spo2_percent" numeric,
	"skin_temp_celsius" numeric,
	"scored_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whoop_recovery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whoop_sleep" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"cycle_id" uuid,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"is_nap" boolean,
	"total_in_bed_seconds" integer,
	"total_awake_seconds" integer,
	"total_light_seconds" integer,
	"total_sws_seconds" integer,
	"total_rem_seconds" integer,
	"sleep_performance_percent" integer,
	"sleep_efficiency_percent" numeric,
	"respiratory_rate" numeric,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whoop_sleep" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whoop_workouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"sport_name" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"strain" numeric,
	"average_heart_rate" integer,
	"max_heart_rate" integer,
	"kilojoules" numeric,
	"distance_meters" numeric,
	"altitude_gain_meters" numeric,
	"hr_zone_durations_seconds" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whoop_workouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basketball_sessions" ADD CONSTRAINT "basketball_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basketball_sessions" ADD CONSTRAINT "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk" FOREIGN KEY ("whoop_workout_id") REFERENCES "public"."whoop_workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_set_id_strength_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."strength_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sessions" ADD CONSTRAINT "strength_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sessions" ADD CONSTRAINT "strength_sessions_whoop_workout_id_whoop_workouts_id_fk" FOREIGN KEY ("whoop_workout_id") REFERENCES "public"."whoop_workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "strength_sets_session_id_strength_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."strength_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "strength_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_experiments" ADD CONSTRAINT "supplement_experiments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_experiments" ADD CONSTRAINT "supplement_experiments_supplement_id_supplements_id_fk" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_intakes" ADD CONSTRAINT "supplement_intakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_intakes" ADD CONSTRAINT "supplement_intakes_supplement_id_supplements_id_fk" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_schedules" ADD CONSTRAINT "supplement_schedules_supplement_id_supplements_id_fk" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplements" ADD CONSTRAINT "supplements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_credentials" ADD CONSTRAINT "whoop_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_cycles" ADD CONSTRAINT "whoop_cycles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ADD CONSTRAINT "whoop_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ADD CONSTRAINT "whoop_recovery_cycle_id_whoop_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."whoop_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ADD CONSTRAINT "whoop_sleep_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ADD CONSTRAINT "whoop_sleep_cycle_id_whoop_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."whoop_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_workouts" ADD CONSTRAINT "whoop_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_insights_user_surfaced_idx" ON "ai_insights" USING btree ("user_id","surfaced_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "basketball_sessions_user_played_idx" ON "basketball_sessions" USING btree ("user_id","played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checkins_user_date_idx" ON "daily_checkins" USING btree ("user_id","check_date");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_idx" ON "exercises" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "personal_records_user_exercise_idx" ON "personal_records" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "strength_sessions_user_performed_idx" ON "strength_sessions" USING btree ("user_id","performed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "strength_sets_session_idx" ON "strength_sets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "supplement_intakes_user_taken_idx" ON "supplement_intakes" USING btree ("user_id","taken_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sync_logs_user_started_idx" ON "sync_logs" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_user_week_idx" ON "weekly_reviews" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "whoop_cycles_user_start_idx" ON "whoop_cycles" USING btree ("user_id","start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whoop_recovery_user_scored_idx" ON "whoop_recovery" USING btree ("user_id","scored_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whoop_sleep_user_start_idx" ON "whoop_sleep" USING btree ("user_id","start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whoop_workouts_user_start_idx" ON "whoop_workouts" USING btree ("user_id","start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whoop_workouts_sport_idx" ON "whoop_workouts" USING btree ("sport_name");--> statement-breakpoint
CREATE POLICY "ai_insights_owner" ON "ai_insights" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "basketball_sessions_owner" ON "basketball_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "daily_checkins_owner" ON "daily_checkins" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "exercises_owner" ON "exercises" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "personal_records_owner" ON "personal_records" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "strength_sessions_owner" ON "strength_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "strength_sets_owner" ON "strength_sets" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from strength_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from strength_sessions s where s.id = session_id and s.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "supplement_experiments_owner" ON "supplement_experiments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "supplement_intakes_owner" ON "supplement_intakes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "supplement_schedules_owner" ON "supplement_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from supplements s where s.id = supplement_id and s.user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from supplements s where s.id = supplement_id and s.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "supplements_owner" ON "supplements" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "sync_logs_owner" ON "sync_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "weekly_reviews_owner" ON "weekly_reviews" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "whoop_credentials_owner" ON "whoop_credentials" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "whoop_cycles_owner" ON "whoop_cycles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "whoop_recovery_owner" ON "whoop_recovery" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "whoop_sleep_owner" ON "whoop_sleep" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "whoop_workouts_owner" ON "whoop_workouts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);