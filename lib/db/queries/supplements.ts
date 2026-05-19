import "server-only"

import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
import { subDays } from "date-fns"
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"

import { db } from "@/lib/db"
import {
  supplements,
  supplementSchedules,
  supplementIntakes,
  supplementExperiments,
  whoopRecovery,
  whoopSleep,
} from "@/lib/db/schema"
import type { HealthDay } from "@/lib/supplements/experiment-analysis"

const TZ = "Europe/Bucharest"

export type Supplement = typeof supplements.$inferSelect
export type SupplementSchedule = typeof supplementSchedules.$inferSelect
export type SupplementExperiment = typeof supplementExperiments.$inferSelect

export type IntakeStatus = "taken" | "skipped" | "pending"

function dayWindow(localDate: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(new Date(`${localDate}T00:00:00`), TZ),
    end: fromZonedTime(new Date(`${localDate}T23:59:59.999`), TZ),
  }
}

/** Today's date key (YYYY-MM-DD) in Europe/Bucharest. */
export function todayLocal(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
}

// ─────────────────────────── Supplement CRUD ───────────────────────────

export async function getActiveSupplements(
  userId: string,
): Promise<Supplement[]> {
  return db
    .select()
    .from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.archived, false)))
    .orderBy(asc(supplements.name))
}

export async function getSupplement(
  userId: string,
  supplementId: string,
): Promise<{ supplement: Supplement; schedules: SupplementSchedule[] } | null> {
  const [supplement] = await db
    .select()
    .from(supplements)
    .where(
      and(eq(supplements.id, supplementId), eq(supplements.userId, userId)),
    )
  if (!supplement) return null

  const schedules = await db
    .select()
    .from(supplementSchedules)
    .where(eq(supplementSchedules.supplementId, supplementId))
    .orderBy(asc(supplementSchedules.timeOfDay))

  return { supplement, schedules }
}

export type SupplementInput = {
  name: string
  defaultDose?: number | null
  doseUnit?: string | null
  category?: string | null
  costPerServingRon?: number | null
  notes?: string | null
}

function toSupplementRow(data: SupplementInput) {
  return {
    name: data.name,
    defaultDose:
      data.defaultDose != null ? String(data.defaultDose) : null,
    doseUnit: data.doseUnit ?? null,
    category: data.category ?? null,
    costPerServingRon:
      data.costPerServingRon != null ? String(data.costPerServingRon) : null,
    notes: data.notes ?? null,
  }
}

export async function createSupplement(
  userId: string,
  data: SupplementInput,
): Promise<Supplement> {
  const [supplement] = await db
    .insert(supplements)
    .values({ userId, ...toSupplementRow(data) })
    .returning()
  return supplement
}

export async function updateSupplement(
  userId: string,
  supplementId: string,
  data: SupplementInput,
): Promise<Supplement | undefined> {
  const [supplement] = await db
    .update(supplements)
    .set(toSupplementRow(data))
    .where(
      and(eq(supplements.id, supplementId), eq(supplements.userId, userId)),
    )
    .returning()
  return supplement
}

export async function archiveSupplement(
  userId: string,
  supplementId: string,
): Promise<void> {
  await db
    .update(supplements)
    .set({ archived: true })
    .where(
      and(eq(supplements.id, supplementId), eq(supplements.userId, userId)),
    )
}

// ─────────────────────────── Intakes ───────────────────────────

export type SupplementWithStatus = {
  supplement: Supplement
  status: IntakeStatus
}

export async function getTodayIntakeStatus(
  userId: string,
  localDate: string,
): Promise<SupplementWithStatus[]> {
  const active = await getActiveSupplements(userId)
  if (active.length === 0) return []

  const { start, end } = dayWindow(localDate)
  const intakes = await db
    .select({
      supplementId: supplementIntakes.supplementId,
      skipped: supplementIntakes.skipped,
    })
    .from(supplementIntakes)
    .where(
      and(
        eq(supplementIntakes.userId, userId),
        gte(supplementIntakes.takenAt, start),
        lte(supplementIntakes.takenAt, end),
      ),
    )

  const byId = new Map<string, IntakeStatus>()
  for (const intake of intakes) {
    // A non-skipped intake always wins over a skipped one.
    if (intake.skipped && !byId.has(intake.supplementId)) {
      byId.set(intake.supplementId, "skipped")
    } else if (!intake.skipped) {
      byId.set(intake.supplementId, "taken")
    }
  }

  return active.map((supplement) => ({
    supplement,
    status: byId.get(supplement.id) ?? "pending",
  }))
}

export async function markIntake(
  userId: string,
  supplementId: string,
  localDate: string,
  status: "taken" | "skipped" | "undo",
): Promise<void> {
  const { start, end } = dayWindow(localDate)

  // Ownership guard — the direct DB connection bypasses RLS.
  const [supplement] = await db
    .select({ id: supplements.id, defaultDose: supplements.defaultDose })
    .from(supplements)
    .where(
      and(eq(supplements.id, supplementId), eq(supplements.userId, userId)),
    )
  if (!supplement) throw new Error("Supplement not found")

  await db
    .delete(supplementIntakes)
    .where(
      and(
        eq(supplementIntakes.userId, userId),
        eq(supplementIntakes.supplementId, supplementId),
        gte(supplementIntakes.takenAt, start),
        lte(supplementIntakes.takenAt, end),
      ),
    )

  if (status === "undo") return

  await db.insert(supplementIntakes).values({
    userId,
    supplementId,
    takenAt: fromZonedTime(new Date(`${localDate}T12:00:00`), TZ),
    dose: status === "taken" ? supplement.defaultDose : null,
    skipped: status === "skipped",
  })
}

export type AdherenceRow = {
  supplement: Supplement
  cells: Array<{ date: string; status: IntakeStatus }>
}

export async function getAdherenceGrid(
  userId: string,
  days = 7,
): Promise<{ dates: string[]; rows: AdherenceRow[] }> {
  const active = await getActiveSupplements(userId)

  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(toZonedTime(new Date(), TZ), i)
    dates.push(formatInTimeZone(d, TZ, "yyyy-MM-dd"))
  }

  if (active.length === 0) return { dates, rows: [] }

  const since = dayWindow(dates[0]).start
  const intakes = await db
    .select({
      supplementId: supplementIntakes.supplementId,
      takenAt: supplementIntakes.takenAt,
      skipped: supplementIntakes.skipped,
    })
    .from(supplementIntakes)
    .where(
      and(
        eq(supplementIntakes.userId, userId),
        gte(supplementIntakes.takenAt, since),
      ),
    )

  // Map<supplementId, Map<dateKey, status>>
  const map = new Map<string, Map<string, IntakeStatus>>()
  for (const intake of intakes) {
    const dateKey = formatInTimeZone(intake.takenAt, TZ, "yyyy-MM-dd")
    if (!map.has(intake.supplementId)) map.set(intake.supplementId, new Map())
    const inner = map.get(intake.supplementId)!
    if (!intake.skipped) inner.set(dateKey, "taken")
    else if (!inner.has(dateKey)) inner.set(dateKey, "skipped")
  }

  const rows: AdherenceRow[] = active.map((supplement) => ({
    supplement,
    cells: dates.map((date) => ({
      date,
      status: map.get(supplement.id)?.get(date) ?? "pending",
    })),
  }))

  return { dates, rows }
}

// ─────────────────────────── Schedules ───────────────────────────

export type ScheduleInput = {
  timeOfDay: string | null // "HH:MM"
  daysOfWeek: number[] | null
  active: boolean
}

async function assertSupplementOwner(
  userId: string,
  supplementId: string,
): Promise<void> {
  const [supplement] = await db
    .select({ id: supplements.id })
    .from(supplements)
    .where(
      and(eq(supplements.id, supplementId), eq(supplements.userId, userId)),
    )
  if (!supplement) throw new Error("Supplement not found")
}

export async function createSchedule(
  userId: string,
  supplementId: string,
  data: ScheduleInput,
): Promise<void> {
  await assertSupplementOwner(userId, supplementId)
  await db.insert(supplementSchedules).values({
    supplementId,
    timeOfDay: data.timeOfDay,
    daysOfWeek: data.daysOfWeek,
    active: data.active,
  })
}

export async function deleteSchedule(
  userId: string,
  scheduleId: string,
): Promise<void> {
  const [schedule] = await db
    .select({ supplementId: supplementSchedules.supplementId })
    .from(supplementSchedules)
    .where(eq(supplementSchedules.id, scheduleId))
  if (!schedule) return
  await assertSupplementOwner(userId, schedule.supplementId)
  await db
    .delete(supplementSchedules)
    .where(eq(supplementSchedules.id, scheduleId))
}

// ─────────────────────────── Experiments ───────────────────────────

export type ExperimentWithSupplement = {
  experiment: SupplementExperiment
  supplementName: string
}

export async function getExperiments(
  userId: string,
): Promise<ExperimentWithSupplement[]> {
  const rows = await db
    .select({
      experiment: supplementExperiments,
      supplementName: supplements.name,
    })
    .from(supplementExperiments)
    .innerJoin(
      supplements,
      eq(supplements.id, supplementExperiments.supplementId),
    )
    .where(eq(supplementExperiments.userId, userId))
    .orderBy(desc(supplementExperiments.startDate))

  return rows.map((r) => ({
    experiment: r.experiment,
    supplementName: r.supplementName,
  }))
}

export async function createExperiment(
  userId: string,
  data: { supplementId: string; startDate: string; hypothesis: string | null },
): Promise<void> {
  await assertSupplementOwner(userId, data.supplementId)
  await db.insert(supplementExperiments).values({
    userId,
    supplementId: data.supplementId,
    startDate: data.startDate,
    hypothesis: data.hypothesis,
  })
}

export async function updateExperiment(
  userId: string,
  experimentId: string,
  data: { endDate?: string | null; conclusion?: string | null },
): Promise<void> {
  await db
    .update(supplementExperiments)
    .set(data)
    .where(
      and(
        eq(supplementExperiments.id, experimentId),
        eq(supplementExperiments.userId, userId),
      ),
    )
}

// ─────────────────────────── Health metrics ───────────────────────────

/**
 * One row per local calendar date that has any Whoop recovery or sleep data,
 * used to compare experiment windows.
 */
export async function getDailyHealthMetrics(
  userId: string,
): Promise<HealthDay[]> {
  const [recoveries, sleeps] = await Promise.all([
    db
      .select({
        scoredAt: whoopRecovery.scoredAt,
        recoveryScore: whoopRecovery.recoveryScore,
        hrvRmssdMs: whoopRecovery.hrvRmssdMs,
      })
      .from(whoopRecovery)
      .where(eq(whoopRecovery.userId, userId)),
    db
      .select({
        startAt: whoopSleep.startAt,
        sleepPerformancePercent: whoopSleep.sleepPerformancePercent,
      })
      .from(whoopSleep)
      .where(and(eq(whoopSleep.userId, userId), eq(whoopSleep.isNap, false))),
  ])

  const map = new Map<string, HealthDay>()
  const ensure = (date: string): HealthDay => {
    let day = map.get(date)
    if (!day) {
      day = { date, recovery: null, hrv: null, sleepPerformance: null }
      map.set(date, day)
    }
    return day
  }

  for (const r of recoveries) {
    if (!r.scoredAt) continue
    const day = ensure(formatInTimeZone(r.scoredAt, TZ, "yyyy-MM-dd"))
    day.recovery = r.recoveryScore
    day.hrv = r.hrvRmssdMs != null ? parseFloat(r.hrvRmssdMs) : null
  }
  for (const s of sleeps) {
    if (!s.startAt) continue
    const day = ensure(formatInTimeZone(s.startAt, TZ, "yyyy-MM-dd"))
    day.sleepPerformance = s.sleepPerformancePercent
  }

  return Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}
