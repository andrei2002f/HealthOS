import "server-only";

import { and, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { subDays, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Europe/Bucharest";

/** Date key (YYYY-MM-DD) in Europe/Bucharest, not UTC. */
function localKey(d: Date | null): string {
  if (!d) return "";
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

import { db } from "@/lib/db";
import {
  whoopCycles,
  whoopRecovery,
  whoopSleep,
  whoopWorkouts,
} from "@/lib/db/schema";

export type DashboardDay = {
  date: string; // YYYY-MM-DD
  recoveryScore: number | null;
  sleepPerformancePercent: number | null;
  sleepDurationHours: number | null;
  strain: number | null;
};

export type TodayStats = {
  recoveryScore: number | null;
  hrvRmssdMs: number | null;
  restingHeartRate: number | null;
  sleepPerformancePercent: number | null;
  sleepDurationHours: number | null;
  yesterdayStrain: number | null;
  latestWorkoutName: string | null;
  latestWorkoutAt: Date | null;
  latestWorkoutStrain: number | null;
};

/** Returns the most recent recovery row for a user. */
async function getLatestRecovery(userId: string) {
  return db.query.whoopRecovery.findFirst({
    where: eq(whoopRecovery.userId, userId),
    orderBy: [desc(whoopRecovery.scoredAt)],
  });
}

/** Returns the most recent non-nap sleep row for a user. */
async function getLatestSleep(userId: string) {
  return db.query.whoopSleep.findFirst({
    where: and(
      eq(whoopSleep.userId, userId),
      isNotNull(whoopSleep.endAt),
      eq(whoopSleep.isNap, false),
    ),
    orderBy: [desc(whoopSleep.startAt)],
  });
}

/** Returns the cycle whose start_at was most recent before today (yesterday's strain). */
async function getYesterdayStrain(userId: string): Promise<number | null> {
  const todayStart = startOfDay(new Date());
  const row = await db.query.whoopCycles.findFirst({
    where: and(
      eq(whoopCycles.userId, userId),
      lt(whoopCycles.startAt, todayStart),
      isNotNull(whoopCycles.strain),
    ),
    orderBy: [desc(whoopCycles.startAt)],
  });
  return row?.strain != null ? parseFloat(row.strain) : null;
}

/** Returns the latest workout for a user. */
async function getLatestWorkout(userId: string) {
  return db.query.whoopWorkouts.findFirst({
    where: and(eq(whoopWorkouts.userId, userId), isNotNull(whoopWorkouts.endAt)),
    orderBy: [desc(whoopWorkouts.startAt)],
  });
}

/** Aggregated stats for the "Today" card. */
export async function getTodayStats(userId: string): Promise<TodayStats> {
  const [recovery, sleep, workout, yesterdayStrain] = await Promise.all([
    getLatestRecovery(userId),
    getLatestSleep(userId),
    getLatestWorkout(userId),
    getYesterdayStrain(userId),
  ]);

  const sleepSeconds =
    sleep?.totalInBedSeconds != null && sleep?.totalAwakeSeconds != null
      ? sleep.totalInBedSeconds - sleep.totalAwakeSeconds
      : null;

  return {
    recoveryScore: recovery?.recoveryScore ?? null,
    hrvRmssdMs:
      recovery?.hrvRmssdMs != null ? parseFloat(recovery.hrvRmssdMs) : null,
    restingHeartRate: recovery?.restingHeartRate ?? null,
    sleepPerformancePercent: sleep?.sleepPerformancePercent ?? null,
    sleepDurationHours:
      sleepSeconds != null ? Math.round((sleepSeconds / 3600) * 10) / 10 : null,
    yesterdayStrain,
    latestWorkoutName: workout?.sportName ?? null,
    latestWorkoutAt: workout?.startAt ?? null,
    latestWorkoutStrain:
      workout?.strain != null ? parseFloat(workout.strain) : null,
  };
}

/**
 * Returns one row per day for the last `days` days (oldest first),
 * suitable for sparkline charts.
 */
export async function getLast7Days(
  userId: string,
  days = 7,
): Promise<DashboardDay[]> {
  // Fetch one extra day back in UTC so records whose local date falls within
  // the window but whose UTC timestamp is on the previous UTC day are included.
  const since = startOfDay(subDays(new Date(), days));

  const [recoveries, sleeps, cycles] = await Promise.all([
    db
      .select({
        scoredAt: whoopRecovery.scoredAt,
        recoveryScore: whoopRecovery.recoveryScore,
      })
      .from(whoopRecovery)
      .where(
        and(
          eq(whoopRecovery.userId, userId),
          gte(whoopRecovery.scoredAt, since),
        ),
      )
      .orderBy(whoopRecovery.scoredAt),

    db
      .select({
        startAt: whoopSleep.startAt,
        sleepPerformancePercent: whoopSleep.sleepPerformancePercent,
        totalInBedSeconds: whoopSleep.totalInBedSeconds,
        totalAwakeSeconds: whoopSleep.totalAwakeSeconds,
        isNap: whoopSleep.isNap,
      })
      .from(whoopSleep)
      .where(
        and(
          eq(whoopSleep.userId, userId),
          gte(whoopSleep.startAt, since),
          eq(whoopSleep.isNap, false),
          isNotNull(whoopSleep.endAt),
        ),
      )
      .orderBy(whoopSleep.startAt),

    db
      .select({ startAt: whoopCycles.startAt, strain: whoopCycles.strain })
      .from(whoopCycles)
      .where(
        and(
          eq(whoopCycles.userId, userId),
          gte(whoopCycles.startAt, since),
          isNotNull(whoopCycles.strain),
        ),
      )
      .orderBy(whoopCycles.startAt),
  ]);

  // Build a map keyed by YYYY-MM-DD in Europe/Bucharest local time.
  // Records with start_at around 00:00–03:00 local fall on the previous UTC
  // date, so we must key by local date consistently across all sources.
  const map = new Map<string, DashboardDay>();

  for (const r of recoveries) {
    const key = localKey(r.scoredAt);
    if (!key) continue;
    const existing = map.get(key) ?? {
      date: key,
      recoveryScore: null,
      sleepPerformancePercent: null,
      sleepDurationHours: null,
      strain: null,
    };
    existing.recoveryScore = r.recoveryScore;
    map.set(key, existing);
  }

  for (const s of sleeps) {
    const key = localKey(s.startAt);
    if (!key) continue;
    const existing = map.get(key) ?? {
      date: key,
      recoveryScore: null,
      sleepPerformancePercent: null,
      sleepDurationHours: null,
      strain: null,
    };
    existing.sleepPerformancePercent = s.sleepPerformancePercent;
    const secs =
      s.totalInBedSeconds != null && s.totalAwakeSeconds != null
        ? s.totalInBedSeconds - s.totalAwakeSeconds
        : null;
    existing.sleepDurationHours =
      secs != null ? Math.round((secs / 3600) * 10) / 10 : null;
    map.set(key, existing);
  }

  for (const c of cycles) {
    const key = localKey(c.startAt);
    if (!key) continue;
    const existing = map.get(key) ?? {
      date: key,
      recoveryScore: null,
      sleepPerformancePercent: null,
      sleepDurationHours: null,
      strain: null,
    };
    existing.strain = c.strain != null ? parseFloat(c.strain) : null;
    map.set(key, existing);
  }

  // Fill in the 7-day grid using local calendar dates.
  const result: DashboardDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(toZonedTime(new Date(), TZ), i);
    const key = formatInTimeZone(d, TZ, "yyyy-MM-dd");
    result.push(
      map.get(key) ?? {
        date: key,
        recoveryScore: null,
        sleepPerformancePercent: null,
        sleepDurationHours: null,
        strain: null,
      },
    );
  }

  return result;
}
