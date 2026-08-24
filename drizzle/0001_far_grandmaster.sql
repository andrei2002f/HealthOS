-- Whoop v2 returns integer ids, not UUIDs, so every Whoop identifier changes
-- from uuid to text.
--
-- REPAIRED 2026-08-24. As generated, this migration altered the foreign-key
-- child columns before their parents, so between the first ALTER and the last
-- the two sides of each key disagreed on type and Postgres refused:
--
--   ERROR: foreign key constraint
--   "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk"
--   cannot be implemented
--
-- The chain therefore could not be replayed onto an empty database, which is
-- how the defect stayed invisible: production reached this state by another
-- route. The four affected constraints are now dropped first and recreated
-- afterwards with identical definitions. See docs/DECISIONS.md, ADR-0007.
--
-- Safe to edit despite already being applied in production: drizzle compares
-- only the newest applied `created_at` against each journal entry's `when`, and
-- never re-reads the stored hash, so a migration older than the newest applied
-- one is skipped regardless of its content.

ALTER TABLE "basketball_sessions" DROP CONSTRAINT "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk";--> statement-breakpoint
ALTER TABLE "strength_sessions" DROP CONSTRAINT "strength_sessions_whoop_workout_id_whoop_workouts_id_fk";--> statement-breakpoint
ALTER TABLE "whoop_recovery" DROP CONSTRAINT "whoop_recovery_cycle_id_whoop_cycles_id_fk";--> statement-breakpoint
ALTER TABLE "whoop_sleep" DROP CONSTRAINT "whoop_sleep_cycle_id_whoop_cycles_id_fk";--> statement-breakpoint
ALTER TABLE "basketball_sessions" ALTER COLUMN "whoop_workout_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strength_sessions" ALTER COLUMN "whoop_workout_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_cycles" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "cycle_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "sleep_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ALTER COLUMN "cycle_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_workouts" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "basketball_sessions" ADD CONSTRAINT "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk" FOREIGN KEY ("whoop_workout_id") REFERENCES "public"."whoop_workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sessions" ADD CONSTRAINT "strength_sessions_whoop_workout_id_whoop_workouts_id_fk" FOREIGN KEY ("whoop_workout_id") REFERENCES "public"."whoop_workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ADD CONSTRAINT "whoop_recovery_cycle_id_whoop_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."whoop_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ADD CONSTRAINT "whoop_sleep_cycle_id_whoop_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."whoop_cycles"("id") ON DELETE set null ON UPDATE no action;
