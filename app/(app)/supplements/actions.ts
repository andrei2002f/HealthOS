"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  createSupplement,
  updateSupplement,
  archiveSupplement,
  markIntake,
  createSchedule,
  deleteSchedule,
  createExperiment,
  updateExperiment,
  todayLocal,
  type SupplementInput,
} from "@/lib/db/queries/supplements"

type Result = { ok: true } | { ok: false; error: string }

function firstIssue(error: unknown): string {
  // Zod v4: `.issues` exists at runtime but is not in the TS type yet
  const issues = (error as { issues?: { message: string }[] }).issues
  return issues?.[0]?.message ?? "Invalid data"
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// ─────────────────────────── Supplement CRUD ───────────────────────────

const SupplementSchema = z.object({
  name: z.string().min(1).max(100),
  defaultDose: z.number().min(0).nullable().optional(),
  doseUnit: z.string().max(20).optional(),
  category: z.string().max(40).optional(),
  costPerServingRon: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
})

function toInput(data: z.infer<typeof SupplementSchema>): SupplementInput {
  return {
    name: data.name,
    defaultDose: data.defaultDose ?? null,
    doseUnit: data.doseUnit || null,
    category: data.category || null,
    costPerServingRon: data.costPerServingRon ?? null,
    notes: data.notes || null,
  }
}

export async function addSupplement(
  payload: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = SupplementSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  const supplement = await createSupplement(user.id, toInput(parsed.data))
  revalidatePath("/supplements")
  return { ok: true, id: supplement.id }
}

export async function editSupplement(payload: unknown): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = SupplementSchema.extend({
    supplementId: z.string().uuid(),
  }).safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  const { supplementId, ...rest } = parsed.data
  const supplement = await updateSupplement(user.id, supplementId, toInput(rest))
  if (!supplement) return { ok: false, error: "Supplement not found" }

  revalidatePath("/supplements")
  revalidatePath(`/supplements/${supplementId}`)
  return { ok: true }
}

export async function archiveSupplementAction(
  supplementId: string,
): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  await archiveSupplement(user.id, supplementId)
  revalidatePath("/supplements")
  return { ok: true }
}

// ─────────────────────────── Intakes ───────────────────────────

export async function markIntakeAction(
  supplementId: string,
  status: "taken" | "skipped" | "undo",
): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  if (!z.string().uuid().safeParse(supplementId).success) {
    return { ok: false, error: "Invalid supplement" }
  }

  try {
    await markIntake(user.id, supplementId, todayLocal(), status)
  } catch {
    return { ok: false, error: "Could not update intake" }
  }

  revalidatePath("/supplements")
  return { ok: true }
}

// ─────────────────────────── Schedules ───────────────────────────

const ScheduleSchema = z.object({
  supplementId: z.string().uuid(),
  timeOfDay: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
    .nullable()
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
})

export async function saveScheduleAction(payload: unknown): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = ScheduleSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  const { supplementId, timeOfDay, daysOfWeek } = parsed.data
  try {
    await createSchedule(user.id, supplementId, {
      timeOfDay: timeOfDay ?? null,
      daysOfWeek: daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek : null,
      active: true,
    })
  } catch {
    return { ok: false, error: "Supplement not found" }
  }

  revalidatePath(`/supplements/${supplementId}`)
  return { ok: true }
}

export async function deleteScheduleAction(
  scheduleId: string,
  supplementId: string,
): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  try {
    await deleteSchedule(user.id, scheduleId)
  } catch {
    return { ok: false, error: "Could not delete schedule" }
  }

  revalidatePath(`/supplements/${supplementId}`)
  return { ok: true }
}

// ─────────────────────────── Experiments ───────────────────────────

const StartExperimentSchema = z.object({
  supplementId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  hypothesis: z.string().max(2000).optional(),
})

export async function startExperiment(payload: unknown): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = StartExperimentSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  try {
    await createExperiment(user.id, {
      supplementId: parsed.data.supplementId,
      startDate: parsed.data.startDate,
      hypothesis: parsed.data.hypothesis || null,
    })
  } catch {
    return { ok: false, error: "Supplement not found" }
  }

  revalidatePath("/supplements/experiments")
  return { ok: true }
}

const FinishExperimentSchema = z.object({
  experimentId: z.string().uuid(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable()
    .optional(),
  conclusion: z.string().max(4000).optional(),
})

export async function finishExperiment(payload: unknown): Promise<Result> {
  const user = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = FinishExperimentSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  await updateExperiment(user.id, parsed.data.experimentId, {
    endDate: parsed.data.endDate ?? null,
    conclusion: parsed.data.conclusion || null,
  })

  revalidatePath("/supplements/experiments")
  return { ok: true }
}
