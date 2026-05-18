# Strength Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full strength training tracker — session logging with exercises/sets, PR detection, and exercise history charts.

**Architecture:** Pure PR detection logic lives in `lib/strength/pr-detection.ts` (unit-testable). All DB queries in `lib/db/queries/strength.ts`. Server Actions in `app/(app)/strength/actions.ts` handle Zod validation and orchestration. `/strength/new` is a Client Component with local state; one Server Action call on "End session" saves everything and detects PRs. All other pages are Server Components.

**Tech Stack:** Drizzle ORM, Zod, date-fns-tz v3 (`fromZonedTime`), Recharts (e1RM chart), shadcn Sheet (exercise picker), sonner (toasts — already installed at `components/ui/sonner.tsx`)

---

## File Map

**Create:**
- `lib/strength/pr-detection.ts` — pure functions: `calculateE1rm`, `findBestE1rm`, `findTopSet`
- `lib/strength/pr-detection.test.ts` — vitest unit tests
- `lib/db/queries/strength.ts` — all strength DB queries
- `app/(app)/strength/actions.ts` — `saveSession` + `addExercise` Server Actions
- `app/(app)/strength/new/page.tsx` — thin Server Component, passes exercises to SessionBuilder
- `app/(app)/strength/[sessionId]/page.tsx` — session detail (Server Component)
- `app/(app)/strength/exercises/[exerciseId]/page.tsx` — exercise detail + e1RM chart
- `components/strength/PRBadge.tsx`
- `components/strength/SetRow.tsx`
- `components/strength/ExerciseSearchSheet.tsx`
- `components/strength/SessionBuilder.tsx` — main Client Component
- `components/strength/SessionCard.tsx`
- `components/strength/E1rmChart.tsx` — Recharts wrapper

**Modify:**
- `app/(app)/strength/page.tsx` — replace placeholder with paginated session list
- `app/(app)/layout.tsx` — add `<Toaster />` from `components/ui/sonner`

---

## Task 1: Pure PR detection functions + unit tests

**Files:**
- Create: `lib/strength/pr-detection.ts`
- Create: `lib/strength/pr-detection.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `lib/strength/pr-detection.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  calculateE1rm,
  findBestE1rm,
  findTopSet,
} from "./pr-detection"

describe("calculateE1rm", () => {
  it("returns weight unchanged for 1 rep", () => {
    expect(calculateE1rm(100, 1)).toBe(100)
  })
  it("applies Epley formula for multiple reps", () => {
    // 100 * (1 + 10/30) = 133.33...
    expect(calculateE1rm(100, 10)).toBeCloseTo(133.33, 1)
  })
  it("returns 0 for 0 reps", () => {
    expect(calculateE1rm(100, 0)).toBe(0)
  })
})

describe("findBestE1rm", () => {
  it("returns null for empty array", () => {
    expect(findBestE1rm([])).toBeNull()
  })
  it("picks the set with the highest e1RM", () => {
    const sets = [
      { weightKg: 100, reps: 5, setIndex: 1 }, // e1rm = 116.67
      { weightKg: 80, reps: 10, setIndex: 2 },  // e1rm = 106.67
      { weightKg: 90, reps: 8, setIndex: 3 },   // e1rm = 114.00
    ]
    const result = findBestE1rm(sets)
    expect(result?.set.setIndex).toBe(1)
    expect(result?.e1rm).toBeCloseTo(116.67, 1)
  })
  it("handles single set", () => {
    const sets = [{ weightKg: 60, reps: 1, setIndex: 1 }]
    const result = findBestE1rm(sets)
    expect(result?.e1rm).toBe(60)
  })
})

describe("findTopSet", () => {
  it("returns null for empty array", () => {
    expect(findTopSet([])).toBeNull()
  })
  it("picks the heaviest set by weight", () => {
    const sets = [
      { weightKg: 80, reps: 10, setIndex: 1 },
      { weightKg: 100, reps: 3, setIndex: 2 },
      { weightKg: 90, reps: 5, setIndex: 3 },
    ]
    expect(findTopSet(sets)?.setIndex).toBe(2)
  })
})
```

- [ ] **Step 1.2: Run tests — expect them to fail**

```bash
pnpm test lib/strength/pr-detection.test.ts
```

Expected: FAIL with "Cannot find module './pr-detection'"

- [ ] **Step 1.3: Implement the functions**

Create `lib/strength/pr-detection.ts`:

```ts
export type SetInput = {
  weightKg: number
  reps: number
  setIndex: number
}

export function calculateE1rm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function findBestE1rm(
  sets: SetInput[],
): { e1rm: number; set: SetInput } | null {
  if (sets.length === 0) return null
  let best: { e1rm: number; set: SetInput } | null = null
  for (const set of sets) {
    const e1rm = calculateE1rm(set.weightKg, set.reps)
    if (!best || e1rm > best.e1rm) {
      best = { e1rm, set }
    }
  }
  return best
}

export function findTopSet(sets: SetInput[]): SetInput | null {
  if (sets.length === 0) return null
  let top: SetInput | null = null
  for (const set of sets) {
    if (!top || set.weightKg > top.weightKg) {
      top = set
    }
  }
  return top
}
```

- [ ] **Step 1.4: Run tests — expect them to pass**

```bash
pnpm test lib/strength/pr-detection.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add lib/strength/pr-detection.ts lib/strength/pr-detection.test.ts
git commit -m "feat(strength): pure e1RM and PR detection functions with tests"
```

---

## Task 2: DB queries — exercises

**Files:**
- Create: `lib/db/queries/strength.ts`

- [ ] **Step 2.1: Create the file with imports and seed data**

Create `lib/db/queries/strength.ts`:

```ts
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
```

- [ ] **Step 2.2: Commit**

```bash
git add lib/db/queries/strength.ts
git commit -m "feat(strength): exercise queries and seed data"
```

---

## Task 3: DB queries — sessions, history, saveStrengthSession

**Files:**
- Modify: `lib/db/queries/strength.ts`

- [ ] **Step 3.1: Add session list query**

Append to `lib/db/queries/strength.ts`:

```ts
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
```

- [ ] **Step 3.2: Add session detail query**

Append to `lib/db/queries/strength.ts`:

```ts
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
```

- [ ] **Step 3.3: Add exercise history query**

Append to `lib/db/queries/strength.ts`:

```ts
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

  // Derive weightKg: find the set that produced this PR
  // For display we need the actual set — re-query history instead of denormalizing
  // Simple: return e1rm and reps; caller can reconstruct "X kg × N reps"
  // The e1rm formula: e1rm = w*(1+r/30), so w = e1rm/(1+r/30) only if r>1
  const e1rm = parseFloat(pr.value)
  const reps = pr.reps ?? 1
  const weightKg = reps === 1 ? e1rm : e1rm / (1 + reps / 30)

  return { e1rm, weightKg: parseFloat(weightKg.toFixed(2)), reps, achievedAt: pr.achievedAt }
}
```

- [ ] **Step 3.4: Add saveStrengthSession**

Append to `lib/db/queries/strength.ts`:

```ts
// ─────────────────────────── Save session ───────────────────────────

export async function saveStrengthSession(
  userId: string,
  data: SaveSessionInput,
): Promise<{ sessionId: string; newPRs: NewPR[] }> {
  // 1. Insert session + sets in a transaction (atomic)
  const sessionId = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(strengthSessions)
      .values({ userId, performedAt: data.performedAt, notes: data.notes })
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

  // 2. Whoop auto-link (best effort — failure must not lose the session)
  try {
    const localDate = formatInTimeZone(data.performedAt, TZ, "yyyy-MM-dd")
    const dayStartUtc = fromZonedTime(new Date(`${localDate}T00:00:00`), TZ)
    const dayEndUtc = fromZonedTime(new Date(`${localDate}T23:59:59`), TZ)

    const [whoopWorkout] = await db
      .select({ id: whoopWorkouts.id })
      .from(whoopWorkouts)
      .where(
        and(
          eq(whoopWorkouts.userId, userId),
          eq(whoopWorkouts.sportName, "weightlifting"),
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
```

- [ ] **Step 3.5: Commit**

```bash
git add lib/db/queries/strength.ts
git commit -m "feat(strength): session queries, history, and saveStrengthSession with PR detection"
```

---

## Task 4: Server Actions + Zod validation

**Files:**
- Create: `app/(app)/strength/actions.ts`

- [ ] **Step 4.1: Create the Server Actions file**

Create `app/(app)/strength/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  saveStrengthSession,
  createExercise,
  type NewPR,
  type Exercise,
} from "@/lib/db/queries/strength"

// ─────────────────────────── Zod schemas ───────────────────────────

const SetSchema = z.object({
  setIndex: z.number().int().min(1),
  reps: z.number().int().min(1),
  weightKg: z.number().min(0),
  rpe: z.number().min(6).max(10).nullable(),
  isWarmup: z.boolean(),
})

const EntrySchema = z.object({
  exerciseId: z.string().uuid(),
  exerciseName: z.string().min(1),
  sets: z.array(SetSchema).min(1),
})

const SaveSessionSchema = z.object({
  performedAt: z.string().datetime(),
  notes: z.string().optional(),
  entries: z
    .array(EntrySchema)
    .min(1)
    .refine(
      (entries) =>
        entries.some((e) => e.sets.some((s) => !s.isWarmup)),
      { message: "At least one non-warmup set is required" },
    ),
})

const AddExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  primaryMuscle: z.string().optional(),
  equipment: z.string().optional(),
})

// ─────────────────────────── Actions ───────────────────────────

export async function saveSession(
  payload: unknown,
): Promise<
  | { ok: true; sessionId: string; newPRs: NewPR[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = SaveSessionSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data" }
  }

  const { performedAt, notes, entries } = parsed.data

  const result = await saveStrengthSession(user.id, {
    performedAt: new Date(performedAt),
    notes,
    entries,
  })

  revalidatePath("/strength")
  return { ok: true, ...result }
}

export async function addExercise(
  payload: unknown,
): Promise<{ ok: true; exercise: Exercise } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = AddExerciseSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data" }
  }

  try {
    const exercise = await createExercise(user.id, parsed.data)
    revalidatePath("/strength/new")
    return { ok: true, exercise }
  } catch {
    return { ok: false, error: "Exercise already exists" }
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add app/\(app\)/strength/actions.ts
git commit -m "feat(strength): saveSession and addExercise Server Actions with Zod validation"
```

---

## Task 5: Install shadcn Sheet + add Toaster to layout

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 5.1: Install Sheet component**

```bash
pnpm dlx shadcn@latest add sheet
```

Expected: `components/ui/sheet.tsx` created.

- [ ] **Step 5.2: Add Toaster to app layout**

In `app/(app)/layout.tsx`, add the import and the component:

```tsx
// Add import at top
import { Toaster } from "@/components/ui/sonner"

// Add inside the returned JSX, before closing </div>
// Place it just before the final closing tag of the root div:
<Toaster richColors position="top-center" />
```

The full modified file `app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation"

import { MainNav } from "@/components/shared/MainNav"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { signOut } from "./actions"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Health OS</span>
        <div className="hidden md:block">
          <MainNav />
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <main className="flex-1 px-4 py-4 pb-20 md:pb-4">{children}</main>

      <div className="md:hidden">
        <MainNav />
      </div>

      <Toaster richColors position="top-center" />
    </div>
  )
}
```

- [ ] **Step 5.3: Commit**

```bash
git add components/ui/sheet.tsx app/\(app\)/layout.tsx
git commit -m "feat(strength): add Sheet component and Toaster to app layout"
```

---

## Task 6: PRBadge + SetRow components

**Files:**
- Create: `components/strength/PRBadge.tsx`
- Create: `components/strength/SetRow.tsx`

- [ ] **Step 6.1: Create PRBadge**

Create `components/strength/PRBadge.tsx`:

```tsx
export function PRBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      PR
    </span>
  )
}
```

- [ ] **Step 6.2: Create SetRow**

Create `components/strength/SetRow.tsx`:

```tsx
"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRBadge } from "./PRBadge"

type DraftSet = {
  id: string
  reps: number
  weightKg: number
  rpe: number | null
  isWarmup: boolean
}

type SetRowProps = {
  set: DraftSet
  setNumber: number
  isPR?: boolean
  onChange: (changes: Partial<DraftSet>) => void
  onDelete: () => void
}

function StepButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold active:scale-95"
    >
      {label}
    </button>
  )
}

export function SetRow({ set, setNumber, isPR, onChange, onDelete }: SetRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <span className="w-6 text-center text-sm font-medium text-muted-foreground">
        {set.isWarmup ? "W" : setNumber}
      </span>

      {/* Reps */}
      <div className="flex items-center gap-1">
        <StepButton label="−" onClick={() => onChange({ reps: Math.max(1, set.reps - 1) })} />
        <span className="w-8 text-center text-base font-semibold">{set.reps}</span>
        <StepButton label="+" onClick={() => onChange({ reps: set.reps + 1 })} />
      </div>

      <span className="text-muted-foreground">×</span>

      {/* Weight */}
      <div className="flex items-center gap-1">
        <StepButton
          label="−"
          onClick={() => onChange({ weightKg: Math.max(0, parseFloat((set.weightKg - 2.5).toFixed(2))) })}
        />
        <span className="w-14 text-center text-base font-semibold">
          {set.weightKg}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span>
        </span>
        <StepButton
          label="+"
          onClick={() => onChange({ weightKg: parseFloat((set.weightKg + 2.5).toFixed(2)) })}
        />
      </div>

      {isPR && <PRBadge />}

      {/* Warmup toggle */}
      <button
        type="button"
        onClick={() => onChange({ isWarmup: !set.isWarmup })}
        className={`ml-auto text-xs font-medium transition-colors ${
          set.isWarmup
            ? "text-blue-600 dark:text-blue-400"
            : "text-muted-foreground"
        }`}
      >
        W
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 6.3: Commit**

```bash
git add components/strength/PRBadge.tsx components/strength/SetRow.tsx
git commit -m "feat(strength): PRBadge and SetRow components"
```

---

## Task 7: ExerciseSearchSheet

**Files:**
- Create: `components/strength/ExerciseSearchSheet.tsx`

- [ ] **Step 7.1: Create the component**

Create `components/strength/ExerciseSearchSheet.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { Search, Plus, Dumbbell } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { addExercise } from "@/app/(app)/strength/actions"
import type { Exercise } from "@/lib/db/queries/strength"

type Props = {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
  onExerciseCreated: (exercise: Exercise) => void
}

export function ExerciseSearchSheet({
  open,
  onClose,
  exercises,
  onSelect,
  onExerciseCreated,
}: Props) {
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.primaryMuscle ?? "").toLowerCase().includes(query.toLowerCase()),
  )

  const exactMatch = exercises.some(
    (e) => e.name.toLowerCase() === query.toLowerCase(),
  )
  const showCreateOption = query.trim().length > 1 && !exactMatch

  function handleSelect(exercise: Exercise) {
    onSelect(exercise)
    setQuery("")
    onClose()
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await addExercise({ name: query.trim() })
      if (result.ok) {
        onExerciseCreated(result.exercise)
        onSelect(result.exercise)
        setQuery("")
        onClose()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Add exercise</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2 border-b pb-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search or create..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="mt-2 flex-1 overflow-y-auto">
          {showCreateOption && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-left"
              onClick={handleCreate}
              disabled={isPending}
            >
              <Plus className="h-4 w-4" />
              Create &ldquo;{query.trim()}&rdquo;
            </Button>
          )}

          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => handleSelect(exercise)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-accent"
            >
              <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-medium">{exercise.name}</span>
              {exercise.primaryMuscle && (
                <Badge variant="secondary" className="text-xs">
                  {exercise.primaryMuscle}
                </Badge>
              )}
            </button>
          ))}

          {filtered.length === 0 && !showCreateOption && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No exercises found
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add components/strength/ExerciseSearchSheet.tsx
git commit -m "feat(strength): ExerciseSearchSheet with search and quick-create"
```

---

## Task 8: SessionBuilder (Client Component)

**Files:**
- Create: `components/strength/SessionBuilder.tsx`

- [ ] **Step 8.1: Create the component**

Create `components/strength/SessionBuilder.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { Plus, Dumbbell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SetRow } from "./SetRow"
import { ExerciseSearchSheet } from "./ExerciseSearchSheet"
import { saveSession } from "@/app/(app)/strength/actions"
import type { Exercise } from "@/lib/db/queries/strength"

// ──────────── types ────────────

type DraftSet = {
  id: string
  reps: number
  weightKg: number
  rpe: number | null
  isWarmup: boolean
}

type DraftEntry = {
  id: string
  exercise: Exercise
  sets: DraftSet[]
}

function makeSet(overrides?: Partial<DraftSet>): DraftSet {
  return {
    id: crypto.randomUUID(),
    reps: 5,
    weightKg: 60,
    rpe: null,
    isWarmup: false,
    ...overrides,
  }
}

// ──────────── component ────────────

type Props = {
  initialExercises: Exercise[]
  defaultDate: string // "YYYY-MM-DD"
}

export function SessionBuilder({ initialExercises, defaultDate }: Props) {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises)
  const [entries, setEntries] = useState<DraftEntry[]>([])
  const [date, setDate] = useState(defaultDate)
  const [notes, setNotes] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── entry mutations ──

  function addEntry(exercise: Exercise) {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), exercise, sets: [makeSet()] },
    ])
  }

  function removeEntry(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  function addSet(entryId: string, cloneLast: boolean) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        const lastSet = entry.sets.at(-1)
        const newSet = cloneLast && lastSet
          ? makeSet({ reps: lastSet.reps, weightKg: lastSet.weightKg })
          : makeSet()
        return { ...entry, sets: [...entry.sets, newSet] }
      }),
    )
  }

  function removeSet(entryId: string, setId: string) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        return { ...entry, sets: entry.sets.filter((s) => s.id !== setId) }
      }),
    )
  }

  function updateSet(entryId: string, setId: string, changes: Partial<DraftSet>) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        return {
          ...entry,
          sets: entry.sets.map((s) =>
            s.id === setId ? { ...s, ...changes } : s,
          ),
        }
      }),
    )
  }

  // ── submit ──

  async function handleSubmit() {
    if (entries.length === 0) {
      toast.error("Add at least one exercise")
      return
    }

    setIsSubmitting(true)

    const payload = {
      // Use noon of the selected date so timezone shifts never change the day
      performedAt: new Date(`${date}T12:00:00`).toISOString(),
      notes: notes.trim() || undefined,
      entries: entries.map((entry) => ({
        exerciseId: entry.exercise.id,
        exerciseName: entry.exercise.name,
        sets: entry.sets.map((s, i) => ({
          setIndex: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rpe: s.rpe,
          isWarmup: s.isWarmup,
        })),
      })),
    }

    const result = await saveSession(payload)

    if (!result.ok) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    if (result.newPRs.length > 0) {
      result.newPRs.forEach((pr) => {
        const label =
          pr.type === "e1rm"
            ? `e1RM ${pr.value.toFixed(1)} kg`
            : `${pr.value} kg top set`
        toast.success(`🎉 PR — ${pr.exerciseName}: ${label}`)
      })
    } else {
      toast.success("Session saved!")
    }

    router.push("/strength")
  }

  const hasEntries = entries.length > 0

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header fields */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Date
          </label>
          <input
            type="date"
            value={date}
            max={defaultDate}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="How did it go?"
            className="w-full resize-none rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Exercise entries */}
      {entries.map((entry) => {
        const nonWarmupCount = entry.sets.filter((s) => !s.isWarmup).length
        return (
          <div key={entry.id} className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold">{entry.exercise.name}</p>
                {entry.exercise.primaryMuscle && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {entry.exercise.primaryMuscle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {entry.sets.map((set, idx) => {
                const nonWarmupIdx = entry.sets
                  .slice(0, idx + 1)
                  .filter((s) => !s.isWarmup).length
                return (
                  <SetRow
                    key={set.id}
                    set={set}
                    setNumber={nonWarmupIdx}
                    onChange={(changes) => updateSet(entry.id, set.id, changes)}
                    onDelete={() => removeSet(entry.id, set.id)}
                  />
                )
              })}
            </div>

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => addSet(entry.id, false)}
              >
                + Set
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={entry.sets.length === 0}
                onClick={() => addSet(entry.id, true)}
              >
                Same as last
              </Button>
            </div>
          </div>
        )
      })}

      {/* Add exercise button */}
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={() => setSheetOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add exercise
      </Button>

      {!hasEntries && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <Dumbbell className="h-8 w-8" />
          <p className="text-sm">Tap "Add exercise" to start logging</p>
        </div>
      )}

      {/* Exercise picker sheet */}
      <ExerciseSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        exercises={exercises}
        onSelect={addEntry}
        onExerciseCreated={(ex) => setExercises((prev) => [...prev, ex])}
      />

      {/* Sticky End session bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={isSubmitting || !hasEntries}
        >
          {isSubmitting ? "Saving..." : "End session"}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
git add components/strength/SessionBuilder.tsx
git commit -m "feat(strength): SessionBuilder client component with full logging UX"
```

---

## Task 9: /strength/new page

**Files:**
- Create: `app/(app)/strength/new/page.tsx`

- [ ] **Step 9.1: Create the page**

Create `app/(app)/strength/new/page.tsx`:

```tsx
import { formatInTimeZone } from "date-fns-tz"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getExercises, seedExercises } from "@/lib/db/queries/strength"
import { SessionBuilder } from "@/components/strength/SessionBuilder"

const TZ = "Europe/Bucharest"

export default async function NewSessionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Auto-seed exercises on first use
  await seedExercises(user.id)

  const exercises = await getExercises(user.id)
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">New session</h1>
      <SessionBuilder initialExercises={exercises} defaultDate={today} />
    </div>
  )
}
```

- [ ] **Step 9.2: Commit**

```bash
git add "app/(app)/strength/new/page.tsx"
git commit -m "feat(strength): /strength/new page"
```

---

## Task 10: SessionCard + /strength list page

**Files:**
- Create: `components/strength/SessionCard.tsx`
- Modify: `app/(app)/strength/page.tsx`

- [ ] **Step 10.1: Create SessionCard**

Create `components/strength/SessionCard.tsx`:

```tsx
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { Badge } from "@/components/ui/badge"
import type { SessionSummary } from "@/lib/db/queries/strength"

const TZ = "Europe/Bucharest"

type Props = {
  session: SessionSummary
}

export function SessionCard({ session }: Props) {
  const dateLabel = formatInTimeZone(session.performedAt, TZ, "d MMM yyyy")

  return (
    <Link
      href={`/strength/${session.id}`}
      className="block rounded-xl border p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{dateLabel}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {session.exerciseCount}{" "}
            {session.exerciseCount === 1 ? "exercise" : "exercises"} ·{" "}
            {session.setCount} {session.setCount === 1 ? "set" : "sets"}
          </p>
        </div>
        {session.whoopWorkoutId && (
          <Badge variant="secondary" className="text-xs">
            Whoop
          </Badge>
        )}
      </div>
      {session.notes && (
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {session.notes}
        </p>
      )}
    </Link>
  )
}
```

- [ ] **Step 10.2: Replace placeholder with real list page**

Replace the contents of `app/(app)/strength/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  getStrengthSessions,
  seedExercises,
} from "@/lib/db/queries/strength"
import { SessionCard } from "@/components/strength/SessionCard"
import { Button } from "@/components/ui/button"

export default async function StrengthPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Seed exercises on first visit (idempotent)
  await seedExercises(user.id)

  const sessions = await getStrengthSessions(user.id, 20, 0)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Strength</h1>
        <Button asChild size="sm">
          <Link href="/strength/new">+ New session</Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p>No sessions yet.</p>
          <Button asChild variant="outline">
            <Link href="/strength/new">Log your first session</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 10.3: Commit**

```bash
git add components/strength/SessionCard.tsx app/\(app\)/strength/page.tsx
git commit -m "feat(strength): session list page with auto-seed"
```

---

## Task 11: /strength/[sessionId] page

**Files:**
- Create: `app/(app)/strength/[sessionId]/page.tsx`

- [ ] **Step 11.1: Create the page**

Create `app/(app)/strength/[sessionId]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { createClient } from "@/lib/supabase/server"
import { getStrengthSession } from "@/lib/db/queries/strength"
import { PRBadge } from "@/components/strength/PRBadge"
import { Badge } from "@/components/ui/badge"

const TZ = "Europe/Bucharest"

type Props = {
  params: Promise<{ sessionId: string }>
}

export default async function SessionDetailPage({ params }: Props) {
  const { sessionId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const data = await getStrengthSession(user.id, sessionId)
  if (!data) notFound()

  const { session, entries } = data
  const dateLabel = formatInTimeZone(session.performedAt, TZ, "EEEE, d MMM yyyy")

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link href="/strength" className="text-sm text-muted-foreground hover:underline">
          ← Strength
        </Link>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{dateLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "exercise" : "exercises"}
          </p>
        </div>
        {session.whoopWorkoutId && (
          <Badge variant="secondary">Whoop linked</Badge>
        )}
      </div>

      {session.notes && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">
          {session.notes}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.exerciseId} className="rounded-xl border p-4">
            <Link
              href={`/strength/exercises/${entry.exerciseId}`}
              className="mb-3 block font-semibold hover:underline"
            >
              {entry.exerciseName}
            </Link>

            <div className="flex flex-col gap-1.5">
              {entry.sets.map((set, i) => (
                <div
                  key={set.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-6 text-center text-muted-foreground">
                    {set.isWarmup ? "W" : i + 1}
                  </span>
                  <span className="font-medium">
                    {set.reps} × {set.weightKg} kg
                  </span>
                  {set.rpe && (
                    <span className="text-muted-foreground">RPE {set.rpe}</span>
                  )}
                  {set.isPR && <PRBadge />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 11.2: Commit**

```bash
git add "app/(app)/strength/[sessionId]/page.tsx"
git commit -m "feat(strength): session detail page"
```

---

## Task 12: E1rmChart + exercise detail page

**Files:**
- Create: `components/strength/E1rmChart.tsx`
- Create: `app/(app)/strength/exercises/[exerciseId]/page.tsx`

- [ ] **Step 12.1: Create E1rmChart**

Create `components/strength/E1rmChart.tsx`:

```tsx
"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts"
import type { E1rmDataPoint } from "@/lib/db/queries/strength"

type Props = {
  data: E1rmDataPoint[]
  prE1rm: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: E1rmDataPoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow">
      <p className="font-semibold">{d.date}</p>
      <p>e1RM: {d.e1rm.toFixed(1)} kg</p>
      <p className="text-muted-foreground">
        {d.weightKg} kg × {d.reps} reps
      </p>
    </div>
  )
}

export function E1rmChart({ data, prE1rm }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    )
  }

  const prPoint = data.find((d) => d.e1rm === prE1rm)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)} // "MM-DD"
        />
        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        {prPoint && (
          <ReferenceDot
            x={prPoint.date}
            y={prPoint.e1rm}
            r={6}
            fill="hsl(var(--destructive))"
            stroke="none"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 12.2: Create exercise detail page**

Create `app/(app)/strength/exercises/[exerciseId]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { createClient } from "@/lib/supabase/server"
import {
  getExercise,
  getExerciseHistory,
  getExerciseAllTimePR,
} from "@/lib/db/queries/strength"
import { E1rmChart } from "@/components/strength/E1rmChart"
import { Badge } from "@/components/ui/badge"

const TZ = "Europe/Bucharest"

type Props = {
  params: Promise<{ exerciseId: string }>
}

export default async function ExerciseDetailPage({ params }: Props) {
  const { exerciseId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [exercise, history, pr] = await Promise.all([
    getExercise(user.id, exerciseId),
    getExerciseHistory(user.id, exerciseId),
    getExerciseAllTimePR(user.id, exerciseId),
  ])

  if (!exercise) notFound()

  const last10 = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link href="/strength" className="text-sm text-muted-foreground hover:underline">
          ← Strength
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{exercise.name}</h1>
          <div className="mt-1 flex gap-2">
            {exercise.primaryMuscle && (
              <Badge variant="secondary" className="capitalize">
                {exercise.primaryMuscle}
              </Badge>
            )}
            {exercise.equipment && (
              <Badge variant="outline" className="capitalize">
                {exercise.equipment}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* PR card */}
      {pr ? (
        <div className="mb-4 rounded-xl border bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All-time best e1RM
          </p>
          <p className="mt-1 text-2xl font-bold">{pr.e1rm.toFixed(1)} kg</p>
          <p className="text-sm text-muted-foreground">
            {pr.weightKg.toFixed(1)} kg × {pr.reps}{" "}
            {pr.reps === 1 ? "rep" : "reps"} ·{" "}
            {formatInTimeZone(pr.achievedAt, TZ, "d MMM yyyy")}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          No PR yet — log a session to start tracking!
        </div>
      )}

      {/* e1RM chart */}
      <div className="mb-4 rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">e1RM (last 90 days)</p>
        <E1rmChart data={history} prE1rm={pr?.e1rm ?? 0} />
      </div>

      {/* Last 10 sessions table */}
      {last10.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-2 text-sm font-medium">
            Last sessions
          </div>
          <div className="divide-y">
            {last10.map((point) => (
              <Link
                key={point.sessionId}
                href={`/strength/${point.sessionId}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
              >
                <span className="text-muted-foreground">{point.date}</span>
                <span className="font-medium">
                  {point.weightKg} kg × {point.reps}
                </span>
                <span className="text-muted-foreground">
                  e1RM {point.e1rm.toFixed(1)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 12.3: Commit**

```bash
git add components/strength/E1rmChart.tsx "app/(app)/strength/exercises/[exerciseId]/page.tsx"
git commit -m "feat(strength): E1rmChart and exercise detail page"
```

---

## Task 13: Final verification

- [ ] **Step 13.1: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors. Fix any type errors before proceeding.

- [ ] **Step 13.2: Run lint**

```bash
pnpm lint
```

Expected: 0 warnings/errors. Fix any issues.

- [ ] **Step 13.3: Run tests**

```bash
pnpm test
```

Expected: all tests pass (at minimum the PR detection tests from Task 1).

- [ ] **Step 13.4: Build**

```bash
pnpm build
```

Expected: successful build with no type or compilation errors.

- [ ] **Step 13.5: Manual smoke test on mobile viewport (375px)**

In browser devtools at 375px width:
1. Navigate to `/strength` — list page loads, seed button triggers if needed
2. Tap "+ New session" — builder opens
3. Tap "Add exercise" — Sheet opens, search works
4. Select "Bench Press" — exercise card appears in builder
5. Add 3 sets with +/− buttons; "Same as last" clones last set; "W" toggle marks warmup
6. Tap "End session" — saves and redirects to `/strength`
7. Session card appears in list with correct exercise/set counts
8. Tap the session — detail page shows all sets, PR badge if applicable
9. Tap exercise name — exercise detail page loads with chart (empty for first session)
10. Do a second session for same exercise with higher weight — PR toast appears, chart shows two data points

- [ ] **Step 13.6: Final commit**

```bash
git add -A
git commit -m "chore(strength): Week 4 complete — strength tracker with PR detection"
```
