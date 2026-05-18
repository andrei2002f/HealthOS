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
  whoopWorkoutId: z.string().optional(),
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
    // Zod v4: `.issues` exists at runtime but is not in the TS type yet
    const issues = (parsed.error as unknown as { issues: { message: string }[] }).issues
    return { ok: false, error: issues[0]?.message ?? "Invalid data" }
  }

  const { performedAt, notes, whoopWorkoutId, entries } = parsed.data

  const result = await saveStrengthSession(user.id, {
    performedAt: new Date(performedAt),
    notes,
    whoopWorkoutId,
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
    // Zod v4: `.issues` exists at runtime but is not in the TS type yet
    const issues = (parsed.error as unknown as { issues: { message: string }[] }).issues
    return { ok: false, error: issues[0]?.message ?? "Invalid data" }
  }

  try {
    const exercise = await createExercise(user.id, parsed.data)
    revalidatePath("/strength/new")
    return { ok: true, exercise }
  } catch {
    return { ok: false, error: "Exercise already exists" }
  }
}
