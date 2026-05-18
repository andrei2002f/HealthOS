import { and, desc, eq, gte, lt, inArray, sql } from "drizzle-orm"
import { addDays, subDays } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import { db } from "@/lib/db"
import {
  exercises,
  strengthSessions,
  strengthSets,
  personalRecords,
  whoopWorkouts,
} from "@/lib/db/schema"
import {
  findBestE1rm,
  findTopSet,
  calculateE1rm,
} from "@/lib/strength/pr-detection"

const TZ = "Europe/Bucharest"

// ─────────────────────────── Types ───────────────────────────

export type Exercise = typeof exercises.$inferSelect

export type NewPR = {
  exerciseName: string
  type: "e1rm" | "top_set"
  value: number
  reps?: number
}

export type SaveSessionInput = {
  performedAt: Date
  notes?: string
  entries: Array<{
    exerciseId: string
    exerciseName: string
    sets: Array<{
      setIndex: number
      reps: number
      weightKg: number
      rpe: number | null
      isWarmup: boolean
    }>
  }>
}

// ─────────────────────────── Seed data ───────────────────────────

const SEED_EXERCISES: Array<{
  name: string
  primaryMuscle: string
  equipment: string
}> = [
  { name: "Squat (Back)", primaryMuscle: "quads", equipment: "barbell" },
  { name: "Front Squat", primaryMuscle: "quads", equipment: "barbell" },
  { name: "Deadlift (Conventional)", primaryMuscle: "hamstrings", equipment: "barbell" },
  { name: "Romanian Deadlift", primaryMuscle: "hamstrings", equipment: "barbell" },
  { name: "Bench Press", primaryMuscle: "chest", equipment: "barbell" },
  { name: "Incline Dumbbell Press", primaryMuscle: "chest", equipment: "dumbbell" },
  { name: "Overhead Press", primaryMuscle: "shoulders", equipment: "barbell" },
  { name: "Pull-Up", primaryMuscle: "back", equipment: "bodyweight" },
  { name: "Lat Pulldown", primaryMuscle: "back", equipment: "cable" },
  { name: "Barbell Row", primaryMuscle: "back", equipment: "barbell" },
  { name: "Dumbbell Row", primaryMuscle: "back", equipment: "dumbbell" },
  { name: "Seated Cable Row", primaryMuscle: "back", equipment: "cable" },
  { name: "Hip Thrust", primaryMuscle: "glutes", equipment: "barbell" },
  { name: "Bulgarian Split Squat", primaryMuscle: "quads", equipment: "dumbbell" },
  { name: "Leg Press", primaryMuscle: "quads", equipment: "machine" },
  { name: "Leg Curl", primaryMuscle: "hamstrings", equipment: "machine" },
  { name: "Leg Extension", primaryMuscle: "quads", equipment: "machine" },
  { name: "Calf Raise", primaryMuscle: "calves", equipment: "machine" },
  { name: "Dumbbell Curl", primaryMuscle: "biceps", equipment: "dumbbell" },
  { name: "Barbell Curl", primaryMuscle: "biceps", equipment: "barbell" },
  { name: "Hammer Curl", primaryMuscle: "biceps", equipment: "dumbbell" },
  { name: "Triceps Pushdown", primaryMuscle: "triceps", equipment: "cable" },
  { name: "Skullcrusher", primaryMuscle: "triceps", equipment: "barbell" },
  { name: "Lateral Raise", primaryMuscle: "shoulders", equipment: "dumbbell" },
  { name: "Face Pull", primaryMuscle: "shoulders", equipment: "cable" },
  { name: "Plank", primaryMuscle: "core", equipment: "bodyweight" },
  { name: "Hanging Leg Raise", primaryMuscle: "core", equipment: "bodyweight" },
  { name: "Cable Crunch", primaryMuscle: "core", equipment: "cable" },
]

// ─────────────────────────── Exercise queries ───────────────────────────

export async function getExercises(userId: string): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.archived, false)))
    .orderBy(exercises.name)
}

export async function seedExercises(userId: string): Promise<void> {
  await db
    .insert(exercises)
    .values(SEED_EXERCISES.map((e) => ({ ...e, userId })))
    .onConflictDoNothing({ target: [exercises.userId, exercises.name] })
}

export async function createExercise(
  userId: string,
  data: { name: string; primaryMuscle?: string; equipment?: string },
): Promise<Exercise> {
  const [exercise] = await db
    .insert(exercises)
    .values({ userId, ...data })
    .returning()
  return exercise
}

export async function getExercise(
  userId: string,
  exerciseId: string,
): Promise<Exercise | undefined> {
  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
  return exercise
}
