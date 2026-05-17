ALTER TABLE "basketball_sessions" ALTER COLUMN "whoop_workout_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strength_sessions" ALTER COLUMN "whoop_workout_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_cycles" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "cycle_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_recovery" ALTER COLUMN "sleep_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_sleep" ALTER COLUMN "cycle_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "whoop_workouts" ALTER COLUMN "id" SET DATA TYPE text;