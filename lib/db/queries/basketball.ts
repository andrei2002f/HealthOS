import "server-only"

import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { basketballSessions, whoopWorkouts } from "@/lib/db/schema"
import {
  computeBasketballStats,
  type BasketballStats,
} from "@/lib/basketball/stats"

const BASKETBALL_SPORT = "Basketball"

export type BasketballSession = typeof basketballSessions.$inferSelect

export type BasketballInput = {
  playedAt: Date
  sessionType?: string | null
  location?: string | null
  surface?: string | null
  teamScore?: number | null
  opponentScore?: number | null
  points?: number | null
  assists?: number | null
  rebounds?: number | null
  steals?: number | null
  blocks?: number | null
  turnovers?: number | null
  minutesPlayed?: number | null
  effortRating?: number | null
  notes?: string | null
}

// ─────────────────────────── Reads ───────────────────────────

export async function getBasketballSessions(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<BasketballSession[]> {
  return db
    .select()
    .from(basketballSessions)
    .where(eq(basketballSessions.userId, userId))
    .orderBy(desc(basketballSessions.playedAt))
    .limit(limit)
    .offset(offset)
}

export async function getBasketballSession(
  userId: string,
  sessionId: string,
): Promise<BasketballSession | undefined> {
  const [session] = await db
    .select()
    .from(basketballSessions)
    .where(
      and(
        eq(basketballSessions.id, sessionId),
        eq(basketballSessions.userId, userId),
      ),
    )
  return session
}

export async function getBasketballStats(
  userId: string,
): Promise<BasketballStats> {
  const sessions = await db
    .select({
      teamScore: basketballSessions.teamScore,
      opponentScore: basketballSessions.opponentScore,
      points: basketballSessions.points,
      assists: basketballSessions.assists,
      rebounds: basketballSessions.rebounds,
      minutesPlayed: basketballSessions.minutesPlayed,
    })
    .from(basketballSessions)
    .where(eq(basketballSessions.userId, userId))

  return computeBasketballStats(sessions)
}

// ─────────────────────────── Whoop auto-create ───────────────────────────

/**
 * Creates a basketball session for every synced Whoop basketball workout that
 * doesn't have one yet. Idempotent — safe to run on every sync and page load.
 * Sessions start with just the date, Whoop link and duration; the user fills
 * in score and box-score details later by editing the session.
 */
export async function autoCreateBasketballSessions(
  userId: string,
): Promise<number> {
  const unlinked = await db
    .select({
      id: whoopWorkouts.id,
      startAt: whoopWorkouts.startAt,
      endAt: whoopWorkouts.endAt,
    })
    .from(whoopWorkouts)
    .leftJoin(
      basketballSessions,
      eq(basketballSessions.whoopWorkoutId, whoopWorkouts.id),
    )
    .where(
      and(
        eq(whoopWorkouts.userId, userId),
        eq(whoopWorkouts.sportName, BASKETBALL_SPORT),
        isNull(basketballSessions.id),
      ),
    )

  const rows = unlinked
    .filter((w): w is typeof w & { startAt: Date } => w.startAt !== null)
    .map((w) => ({
      userId,
      playedAt: w.startAt,
      whoopWorkoutId: w.id,
      minutesPlayed: w.endAt
        ? Math.round((w.endAt.getTime() - w.startAt.getTime()) / 60000)
        : null,
    }))

  if (rows.length === 0) return 0

  await db.insert(basketballSessions).values(rows)
  return rows.length
}

// ─────────────────────────── Writes ───────────────────────────

function toRow(userId: string, data: BasketballInput) {
  return {
    userId,
    playedAt: data.playedAt,
    sessionType: data.sessionType ?? null,
    location: data.location ?? null,
    surface: data.surface ?? null,
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
    notes: data.notes ?? null,
  }
}

export async function saveBasketballSession(
  userId: string,
  data: BasketballInput,
): Promise<{ sessionId: string }> {
  const [session] = await db
    .insert(basketballSessions)
    .values(toRow(userId, data))
    .returning({ id: basketballSessions.id })

  return { sessionId: session.id }
}

export async function updateBasketballSession(
  userId: string,
  sessionId: string,
  data: BasketballInput,
): Promise<BasketballSession | undefined> {
  // playedAt and whoopWorkoutId are preserved on edit; everything else updates.
  const [session] = await db
    .update(basketballSessions)
    .set(toRow(userId, data))
    .where(
      and(
        eq(basketballSessions.id, sessionId),
        eq(basketballSessions.userId, userId),
      ),
    )
    .returning()
  return session
}
