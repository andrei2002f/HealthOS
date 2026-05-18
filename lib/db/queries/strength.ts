import { and, desc, eq, gte, lt, inArray, isNull, sql } from "drizzle-orm"
import { subDays } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import { db } from "@/lib/db"
import {
  exercises,
  strengthSessions,
  strengthSets,
  personalRecords,
  whoopWorkouts,
} from "@/lib/db/schema"
import { findBestE1rm, findTopSet } from "@/lib/strength/pr-detection"

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
  whoopWorkoutId?: string
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

export async function updateExercise(
  userId: string,
  exerciseId: string,
  data: { name?: string; primaryMuscle?: string | null; equipment?: string | null },
): Promise<Exercise | undefined> {
  const [exercise] = await db
    .update(exercises)
    .set(data)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
    .returning()
  return exercise
}

// ─────────────────────────── Session queries ───────────────────────────

export type SessionSummary = {
  id: string
  performedAt: Date
  whoopWorkoutId: string | null
  notes: string | null
  setCount: number
  exerciseCount: number
}

export async function getStrengthSessions(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<SessionSummary[]> {
  const rows = await db
    .select({
      id: strengthSessions.id,
      performedAt: strengthSessions.performedAt,
      whoopWorkoutId: strengthSessions.whoopWorkoutId,
      notes: strengthSessions.notes,
      setCount: sql<number>`count(${strengthSets.id})::int`,
      exerciseCount:
        sql<number>`count(distinct ${strengthSets.exerciseId})::int`,
    })
    .from(strengthSessions)
    .leftJoin(strengthSets, eq(strengthSets.sessionId, strengthSessions.id))
    .where(eq(strengthSessions.userId, userId))
    .groupBy(
      strengthSessions.id,
      strengthSessions.performedAt,
      strengthSessions.whoopWorkoutId,
      strengthSessions.notes,
    )
    .orderBy(desc(strengthSessions.performedAt))
    .limit(limit)
    .offset(offset)

  return rows
}

export type UnlinkedWhoopWorkout = {
  id: string
  startAt: Date
  endAt: Date | null
  strain: number | null
}

export async function getUnlinkedWhoopWeightliftingWorkouts(
  userId: string,
  limit = 20,
): Promise<UnlinkedWhoopWorkout[]> {
  const rows = await db
    .select({
      id: whoopWorkouts.id,
      startAt: whoopWorkouts.startAt,
      endAt: whoopWorkouts.endAt,
      strain: whoopWorkouts.strain,
      linkedSessionId: strengthSessions.id,
    })
    .from(whoopWorkouts)
    .leftJoin(strengthSessions, eq(strengthSessions.whoopWorkoutId, whoopWorkouts.id))
    .where(
      and(
        eq(whoopWorkouts.userId, userId),
        eq(whoopWorkouts.sportName, "Weightlifting"),
        isNull(strengthSessions.id),
      ),
    )
    .orderBy(desc(whoopWorkouts.startAt))
    .limit(limit)

  return rows
    .filter((r): r is typeof r & { startAt: Date } => r.startAt !== null)
    .map((r) => ({
      id: r.id,
      startAt: r.startAt,
      endAt: r.endAt,
      strain: r.strain !== null ? parseFloat(r.strain) : null,
    }))
}

export type SessionDetail = {
  session: typeof strengthSessions.$inferSelect
  entries: Array<{
    exerciseId: string
    exerciseName: string
    sets: Array<{
      id: string
      setIndex: number
      reps: number | null
      weightKg: string | null
      rpe: string | null
      isWarmup: boolean
      isPR: boolean
    }>
  }>
}

export async function getStrengthSession(
  userId: string,
  sessionId: string,
): Promise<SessionDetail | null> {
  const [session] = await db
    .select()
    .from(strengthSessions)
    .where(
      and(
        eq(strengthSessions.id, sessionId),
        eq(strengthSessions.userId, userId),
      ),
    )
  if (!session) return null

  const sets = await db
    .select({
      id: strengthSets.id,
      exerciseId: strengthSets.exerciseId,
      exerciseName: exercises.name,
      setIndex: strengthSets.setIndex,
      reps: strengthSets.reps,
      weightKg: strengthSets.weightKg,
      rpe: strengthSets.rpe,
      isWarmup: strengthSets.isWarmup,
    })
    .from(strengthSets)
    .leftJoin(exercises, eq(exercises.id, strengthSets.exerciseId))
    .where(eq(strengthSets.sessionId, sessionId))
    .orderBy(strengthSets.setIndex)

  // Find which sets earned PRs
  const setIds = sets.map((s) => s.id)
  const prSetIds = new Set<string>()
  if (setIds.length > 0) {
    const prs = await db
      .select({ setId: personalRecords.setId })
      .from(personalRecords)
      .where(
        and(
          eq(personalRecords.userId, userId),
          inArray(
            personalRecords.setId,
            setIds.filter((id): id is string => id !== null),
          ),
        ),
      )
    prs.forEach((p) => {
      if (p.setId) prSetIds.add(p.setId)
    })
  }

  // Group sets by exercise
  const exerciseMap = new Map<
    string,
    { exerciseName: string; sets: SessionDetail["entries"][0]["sets"] }
  >()
  for (const set of sets) {
    const eid = set.exerciseId ?? "unknown"
    if (!exerciseMap.has(eid)) {
      exerciseMap.set(eid, {
        exerciseName: set.exerciseName ?? "Unknown",
        sets: [],
      })
    }
    exerciseMap.get(eid)!.sets.push({
      id: set.id,
      setIndex: set.setIndex,
      reps: set.reps,
      weightKg: set.weightKg,
      rpe: set.rpe,
      isWarmup: set.isWarmup,
      isPR: prSetIds.has(set.id),
    })
  }

  const entries = Array.from(exerciseMap.entries()).map(
    ([exerciseId, data]) => ({ exerciseId, ...data }),
  )

  return { session, entries }
}

export type E1rmDataPoint = {
  sessionId: string
  date: string       // "YYYY-MM-DD" in Europe/Bucharest
  e1rm: number
  weightKg: number
  reps: number
}

export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
): Promise<E1rmDataPoint[]> {
  const cutoff = subDays(new Date(), 90)

  const rows = await db
    .select({
      sessionId: strengthSessions.id,
      performedAt: strengthSessions.performedAt,
      reps: strengthSets.reps,
      weightKg: strengthSets.weightKg,
      setIndex: strengthSets.setIndex,
    })
    .from(strengthSets)
    .innerJoin(
      strengthSessions,
      eq(strengthSessions.id, strengthSets.sessionId),
    )
    .where(
      and(
        eq(strengthSessions.userId, userId),
        eq(strengthSets.exerciseId, exerciseId),
        eq(strengthSets.isWarmup, false),
        gte(strengthSessions.performedAt, cutoff),
      ),
    )
    .orderBy(desc(strengthSessions.performedAt))

  // Group by session, compute max e1RM per session
  const sessionMap = new Map<
    string,
    {
      performedAt: Date
      sets: Array<{ weightKg: number; reps: number; setIndex: number }>
    }
  >()

  for (const row of rows) {
    if (!row.performedAt || row.reps === null || row.weightKg === null) continue
    if (!sessionMap.has(row.sessionId)) {
      sessionMap.set(row.sessionId, { performedAt: row.performedAt, sets: [] })
    }
    sessionMap.get(row.sessionId)!.sets.push({
      weightKg: parseFloat(row.weightKg),
      reps: row.reps,
      setIndex: row.setIndex,
    })
  }

  return Array.from(sessionMap.entries())
    .map(([sessionId, { performedAt, sets }]) => {
      const best = findBestE1rm(sets)
      if (!best) return null
      return {
        sessionId,
        date: formatInTimeZone(performedAt, TZ, "yyyy-MM-dd"),
        e1rm: parseFloat(best.e1rm.toFixed(2)),
        weightKg: best.set.weightKg,
        reps: best.set.reps,
      }
    })
    .filter((p): p is E1rmDataPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getExerciseAllTimePR(
  userId: string,
  exerciseId: string,
): Promise<{ e1rm: number; weightKg: number; reps: number; achievedAt: Date } | null> {
  const [pr] = await db
    .select({
      value: personalRecords.value,
      reps: personalRecords.reps,
      achievedAt: personalRecords.achievedAt,
    })
    .from(personalRecords)
    .where(
      and(
        eq(personalRecords.userId, userId),
        eq(personalRecords.exerciseId, exerciseId),
        eq(personalRecords.recordType, "e1rm"),
      ),
    )
    .orderBy(desc(personalRecords.value))
    .limit(1)

  if (!pr) return null

  const e1rm = parseFloat(pr.value)
  const reps = pr.reps ?? 1
  const weightKg = reps === 1 ? e1rm : e1rm / (1 + reps / 30)

  return { e1rm, weightKg: parseFloat(weightKg.toFixed(2)), reps, achievedAt: pr.achievedAt }
}

// ─────────────────────────── Save session ───────────────────────────

export async function saveStrengthSession(
  userId: string,
  data: SaveSessionInput,
): Promise<{ sessionId: string; newPRs: NewPR[] }> {
  // 1. Insert session + sets in a transaction (atomic)
  const sessionId = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(strengthSessions)
      .values({
        userId,
        performedAt: data.performedAt,
        notes: data.notes,
        whoopWorkoutId: data.whoopWorkoutId ?? null,
      })
      .returning({ id: strengthSessions.id })

    const allSets = data.entries.flatMap((entry) =>
      entry.sets.map((set) => ({
        sessionId: session.id,
        exerciseId: entry.exerciseId,
        setIndex: set.setIndex,
        reps: set.reps,
        weightKg: String(set.weightKg),
        rpe: set.rpe !== null ? String(set.rpe) : null,
        isWarmup: set.isWarmup,
      })),
    )

    if (allSets.length > 0) {
      await tx.insert(strengthSets).values(allSets)
    }

    return session.id
  })

  // 2. Whoop auto-link (best effort — skip if already linked, failure must not lose the session)
  if (!data.whoopWorkoutId) try {
    const localDate = formatInTimeZone(data.performedAt, TZ, "yyyy-MM-dd")
    const dayStartUtc = fromZonedTime(new Date(`${localDate}T00:00:00`), TZ)
    const dayEndUtc = fromZonedTime(new Date(`${localDate}T23:59:59`), TZ)

    const [whoopWorkout] = await db
      .select({ id: whoopWorkouts.id })
      .from(whoopWorkouts)
      .where(
        and(
          eq(whoopWorkouts.userId, userId),
          eq(whoopWorkouts.sportName, "Weightlifting"),
          gte(whoopWorkouts.startAt, dayStartUtc),
          lt(whoopWorkouts.startAt, dayEndUtc),
        ),
      )
      .limit(1)

    if (whoopWorkout) {
      await db
        .update(strengthSessions)
        .set({ whoopWorkoutId: whoopWorkout.id })
        .where(eq(strengthSessions.id, sessionId))
    }
  } catch (e) {
    console.error("[saveStrengthSession] Whoop auto-link failed:", e)
  }

  // 3. PR detection (per exercise, best effort)
  const newPRs: NewPR[] = []

  for (const entry of data.entries) {
    const nonWarmup = entry.sets
      .filter((s) => !s.isWarmup)
      .map((s) => ({ weightKg: s.weightKg, reps: s.reps, setIndex: s.setIndex }))

    if (nonWarmup.length === 0) continue

    try {
      // e1RM PR
      const bestE1rm = findBestE1rm(nonWarmup)
      if (bestE1rm) {
        const [prevE1rm] = await db
          .select({ value: personalRecords.value })
          .from(personalRecords)
          .where(
            and(
              eq(personalRecords.userId, userId),
              eq(personalRecords.exerciseId, entry.exerciseId),
              eq(personalRecords.recordType, "e1rm"),
            ),
          )
          .orderBy(desc(personalRecords.value))
          .limit(1)

        const prevBest = prevE1rm ? parseFloat(prevE1rm.value) : 0

        if (bestE1rm.e1rm > prevBest) {
          const [winningSet] = await db
            .select({ id: strengthSets.id })
            .from(strengthSets)
            .where(
              and(
                eq(strengthSets.sessionId, sessionId),
                eq(strengthSets.exerciseId, entry.exerciseId),
                eq(strengthSets.setIndex, bestE1rm.set.setIndex),
              ),
            )
            .limit(1)

          await db.insert(personalRecords).values({
            userId,
            exerciseId: entry.exerciseId,
            recordType: "e1rm",
            value: bestE1rm.e1rm.toFixed(2),
            reps: bestE1rm.set.reps,
            achievedAt: data.performedAt,
            setId: winningSet?.id,
          })

          newPRs.push({
            exerciseName: entry.exerciseName,
            type: "e1rm",
            value: parseFloat(bestE1rm.e1rm.toFixed(2)),
            reps: bestE1rm.set.reps,
          })
        }
      }

      // Top-set PR (heaviest weight)
      const topSet = findTopSet(nonWarmup)
      if (topSet) {
        const [prevTop] = await db
          .select({ value: personalRecords.value })
          .from(personalRecords)
          .where(
            and(
              eq(personalRecords.userId, userId),
              eq(personalRecords.exerciseId, entry.exerciseId),
              eq(personalRecords.recordType, "top_set"),
            ),
          )
          .orderBy(desc(personalRecords.value))
          .limit(1)

        const prevTopWeight = prevTop ? parseFloat(prevTop.value) : 0

        if (topSet.weightKg > prevTopWeight) {
          const [topSetRow] = await db
            .select({ id: strengthSets.id })
            .from(strengthSets)
            .where(
              and(
                eq(strengthSets.sessionId, sessionId),
                eq(strengthSets.exerciseId, entry.exerciseId),
                eq(strengthSets.setIndex, topSet.setIndex),
              ),
            )
            .limit(1)

          await db.insert(personalRecords).values({
            userId,
            exerciseId: entry.exerciseId,
            recordType: "top_set",
            value: String(topSet.weightKg),
            reps: topSet.reps,
            achievedAt: data.performedAt,
            setId: topSetRow?.id,
          })

          newPRs.push({
            exerciseName: entry.exerciseName,
            type: "top_set",
            value: topSet.weightKg,
            reps: topSet.reps,
          })
        }
      }
    } catch (e) {
      console.error(
        `[saveStrengthSession] PR detection failed for ${entry.exerciseName}:`,
        e,
      )
    }
  }

  return { sessionId, newPRs }
}
