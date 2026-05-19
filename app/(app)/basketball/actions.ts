"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  saveBasketballSession,
  updateBasketballSession,
  type BasketballInput,
} from "@/lib/db/queries/basketball"

const optCount = z.number().int().min(0).max(999).nullable().optional()

const BasketballSchema = z.object({
  playedAt: z.string().datetime(),
  sessionType: z.string().max(40).optional(),
  location: z.string().max(200).optional(),
  surface: z.string().max(40).optional(),
  teamScore: optCount,
  opponentScore: optCount,
  points: optCount,
  assists: optCount,
  rebounds: optCount,
  steals: optCount,
  blocks: optCount,
  turnovers: optCount,
  minutesPlayed: optCount,
  effortRating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).optional(),
})

const UpdateSchema = BasketballSchema.extend({
  sessionId: z.string().uuid(),
})

function firstIssue(error: unknown): string {
  // Zod v4: `.issues` exists at runtime but is not in the TS type yet
  const issues = (error as { issues?: { message: string }[] }).issues
  return issues?.[0]?.message ?? "Invalid data"
}

function toInput(
  data: z.infer<typeof BasketballSchema>,
): BasketballInput {
  return {
    playedAt: new Date(data.playedAt),
    sessionType: data.sessionType || null,
    location: data.location || null,
    surface: data.surface || null,
    teamScore: data.teamScore ?? null,
    opponentScore: data.opponentScore ?? null,
    points: data.points ?? null,
    assists: data.assists ?? null,
    rebounds: data.rebounds ?? null,
    steals: data.steals ?? null,
    blocks: data.blocks ?? null,
    turnovers: data.turnovers ?? null,
    minutesPlayed: data.minutesPlayed ?? null,
    effortRating: data.effortRating ?? null,
    notes: data.notes || null,
  }
}

export async function saveSession(
  payload: unknown,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = BasketballSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  const { sessionId } = await saveBasketballSession(
    user.id,
    toInput(parsed.data),
  )

  revalidatePath("/basketball")
  return { ok: true, sessionId }
}

export async function updateSession(
  payload: unknown,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const parsed = UpdateSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }

  const { sessionId, ...rest } = parsed.data
  const session = await updateBasketballSession(
    user.id,
    sessionId,
    toInput(rest),
  )
  if (!session) return { ok: false, error: "Session not found" }

  revalidatePath("/basketball")
  revalidatePath(`/basketball/${sessionId}`)
  return { ok: true, sessionId }
}
