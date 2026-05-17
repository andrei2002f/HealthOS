import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  syncLogs,
  whoopCredentials,
  whoopCycles,
  whoopRecovery,
  whoopSleep,
  whoopWorkouts,
} from "@/lib/db/schema";
import type {
  WhoopCycle,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
} from "@/lib/whoop/types";
import { sportName } from "@/lib/whoop/types";

// ─── Credentials ─────────────────────────────────────────────────────────────

export type WhoopCredentialRow = typeof whoopCredentials.$inferSelect;

export async function getWhoopCredentials(
  userId: string,
): Promise<WhoopCredentialRow | undefined> {
  return db.query.whoopCredentials.findFirst({
    where: eq(whoopCredentials.userId, userId),
  });
}

export async function upsertWhoopCredentials(values: {
  userId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: Date;
  scopes: string[];
}): Promise<void> {
  await db
    .insert(whoopCredentials)
    .values(values)
    .onConflictDoUpdate({
      target: whoopCredentials.userId,
      set: {
        accessTokenEncrypted: values.accessTokenEncrypted,
        refreshTokenEncrypted: values.refreshTokenEncrypted,
        expiresAt: values.expiresAt,
        scopes: values.scopes,
        updatedAt: new Date(),
      },
    });
}

export async function updateWhoopTokens(
  userId: string,
  values: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    expiresAt: Date;
  },
): Promise<void> {
  await db
    .update(whoopCredentials)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(whoopCredentials.userId, userId));
}

export async function deleteWhoopCredentials(userId: string): Promise<void> {
  await db
    .delete(whoopCredentials)
    .where(eq(whoopCredentials.userId, userId));
}

export async function markWhoopSynced(userId: string): Promise<void> {
  await db
    .update(whoopCredentials)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(whoopCredentials.userId, userId));
}

// ─── Cycles ──────────────────────────────────────────────────────────────────

export async function upsertCycle(
  userId: string,
  cycle: WhoopCycle,
): Promise<void> {
  const raw = cycle as unknown as Record<string, unknown>;
  await db
    .insert(whoopCycles)
    .values({
      id: cycle.id,
      userId,
      startAt: new Date(cycle.start),
      endAt: cycle.end ? new Date(cycle.end) : null,
      strain: cycle.score?.strain?.toString() ?? null,
      kilojoules: cycle.score?.kilojoule?.toString() ?? null,
      averageHeartRate: cycle.score?.average_heart_rate ?? null,
      maxHeartRate: cycle.score?.max_heart_rate ?? null,
      raw,
    })
    .onConflictDoUpdate({
      target: whoopCycles.id,
      set: {
        endAt: cycle.end ? new Date(cycle.end) : null,
        strain: cycle.score?.strain?.toString() ?? null,
        kilojoules: cycle.score?.kilojoule?.toString() ?? null,
        averageHeartRate: cycle.score?.average_heart_rate ?? null,
        maxHeartRate: cycle.score?.max_heart_rate ?? null,
        raw,
        updatedAt: new Date(),
      },
    });
}

// ─── Recovery ────────────────────────────────────────────────────────────────

export async function upsertRecovery(
  userId: string,
  recovery: WhoopRecovery,
): Promise<void> {
  const raw = recovery as unknown as Record<string, unknown>;
  await db
    .insert(whoopRecovery)
    .values({
      id: recovery.cycle_id, // recovery uses cycle_id as its PK
      userId,
      cycleId: recovery.cycle_id,
      sleepId: recovery.sleep_id,
      recoveryScore: recovery.score?.recovery_score ?? null,
      hrvRmssdMs: recovery.score?.hrv_rmssd_milli?.toString() ?? null,
      restingHeartRate: recovery.score?.resting_heart_rate ?? null,
      spo2Percent: recovery.score?.spo2_percentage?.toString() ?? null,
      skinTempCelsius: recovery.score?.skin_temp_celsius?.toString() ?? null,
      scoredAt: new Date(recovery.updated_at),
      raw,
    })
    .onConflictDoUpdate({
      target: whoopRecovery.id,
      set: {
        recoveryScore: recovery.score?.recovery_score ?? null,
        hrvRmssdMs: recovery.score?.hrv_rmssd_milli?.toString() ?? null,
        restingHeartRate: recovery.score?.resting_heart_rate ?? null,
        spo2Percent: recovery.score?.spo2_percentage?.toString() ?? null,
        skinTempCelsius: recovery.score?.skin_temp_celsius?.toString() ?? null,
        scoredAt: new Date(recovery.updated_at),
        raw,
        updatedAt: new Date(),
      },
    });
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

export async function upsertSleep(
  userId: string,
  sleep: WhoopSleep,
): Promise<void> {
  const s = sleep.score;
  const raw = sleep as unknown as Record<string, unknown>;
  await db
    .insert(whoopSleep)
    .values({
      id: sleep.id,
      userId,
      startAt: sleep.start ? new Date(sleep.start) : null,
      endAt: sleep.end ? new Date(sleep.end) : null,
      isNap: sleep.nap,
      totalInBedSeconds: s
        ? Math.round(s.stage_summary.total_in_bed_time_milli / 1000)
        : null,
      totalAwakeSeconds: s
        ? Math.round(s.stage_summary.total_awake_time_milli / 1000)
        : null,
      totalLightSeconds: s
        ? Math.round(s.stage_summary.total_light_sleep_time_milli / 1000)
        : null,
      totalSwsSeconds: s
        ? Math.round(s.stage_summary.total_slow_wave_sleep_time_milli / 1000)
        : null,
      totalRemSeconds: s
        ? Math.round(s.stage_summary.total_rem_sleep_time_milli / 1000)
        : null,
      sleepPerformancePercent: s?.sleep_performance_percentage ?? null,
      sleepEfficiencyPercent:
        s?.sleep_efficiency_percentage?.toString() ?? null,
      respiratoryRate: s?.respiratory_rate?.toString() ?? null,
      raw,
    })
    .onConflictDoUpdate({
      target: whoopSleep.id,
      set: {
        endAt: sleep.end ? new Date(sleep.end) : null,
        totalInBedSeconds: s
          ? Math.round(s.stage_summary.total_in_bed_time_milli / 1000)
          : null,
        totalAwakeSeconds: s
          ? Math.round(s.stage_summary.total_awake_time_milli / 1000)
          : null,
        totalLightSeconds: s
          ? Math.round(s.stage_summary.total_light_sleep_time_milli / 1000)
          : null,
        totalSwsSeconds: s
          ? Math.round(s.stage_summary.total_slow_wave_sleep_time_milli / 1000)
          : null,
        totalRemSeconds: s
          ? Math.round(s.stage_summary.total_rem_sleep_time_milli / 1000)
          : null,
        sleepPerformancePercent: s?.sleep_performance_percentage ?? null,
        sleepEfficiencyPercent:
          s?.sleep_efficiency_percentage?.toString() ?? null,
        respiratoryRate: s?.respiratory_rate?.toString() ?? null,
        raw,
        updatedAt: new Date(),
      },
    });
}

// ─── Workouts ────────────────────────────────────────────────────────────────

export async function upsertWorkout(
  userId: string,
  workout: WhoopWorkout,
): Promise<void> {
  const w = workout.score;
  const raw = workout as unknown as Record<string, unknown>;
  const zones = w?.zone_duration
    ? {
        z0: Math.round((w.zone_duration.zone_zero_milli ?? 0) / 1000),
        z1: Math.round(w.zone_duration.zone_one_milli / 1000),
        z2: Math.round(w.zone_duration.zone_two_milli / 1000),
        z3: Math.round(w.zone_duration.zone_three_milli / 1000),
        z4: Math.round(w.zone_duration.zone_four_milli / 1000),
        z5: Math.round(w.zone_duration.zone_five_milli / 1000),
      }
    : null;

  await db
    .insert(whoopWorkouts)
    .values({
      id: workout.id,
      userId,
      sportName: sportName(workout.sport_id),
      startAt: workout.start ? new Date(workout.start) : null,
      endAt: workout.end ? new Date(workout.end) : null,
      strain: w?.strain?.toString() ?? null,
      averageHeartRate: w?.average_heart_rate ?? null,
      maxHeartRate: w?.max_heart_rate ?? null,
      kilojoules: w?.kilojoule?.toString() ?? null,
      distanceMeters: w?.distance_meter?.toString() ?? null,
      altitudeGainMeters: w?.altitude_gain_meter?.toString() ?? null,
      hrZoneDurationsSeconds: zones,
      raw,
    })
    .onConflictDoUpdate({
      target: whoopWorkouts.id,
      set: {
        endAt: workout.end ? new Date(workout.end) : null,
        strain: w?.strain?.toString() ?? null,
        averageHeartRate: w?.average_heart_rate ?? null,
        maxHeartRate: w?.max_heart_rate ?? null,
        kilojoules: w?.kilojoule?.toString() ?? null,
        distanceMeters: w?.distance_meter?.toString() ?? null,
        altitudeGainMeters: w?.altitude_gain_meter?.toString() ?? null,
        hrZoneDurationsSeconds: zones,
        raw,
        updatedAt: new Date(),
      },
    });
}

// ─── Sync logs ───────────────────────────────────────────────────────────────

export type SyncLogRow = typeof syncLogs.$inferSelect;

export async function insertSyncLog(values: {
  userId: string;
  job: string;
  status: string;
  startedAt: Date;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(syncLogs)
    .values(values)
    .returning({ id: syncLogs.id });
  return row;
}

export async function updateSyncLog(
  id: string,
  values: {
    status: string;
    recordsSynced?: number;
    finishedAt: Date;
    error?: string;
  },
): Promise<void> {
  await db.update(syncLogs).set(values).where(eq(syncLogs.id, id));
}

export async function getRecentSyncLogs(
  userId: string,
  limit = 10,
): Promise<SyncLogRow[]> {
  return db.query.syncLogs.findMany({
    where: eq(syncLogs.userId, userId),
    orderBy: [desc(syncLogs.startedAt)],
    limit,
  });
}

// ─── Cron helper ─────────────────────────────────────────────────────────────

export async function getAllWhoopUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: whoopCredentials.userId })
    .from(whoopCredentials);
  return rows.map((r) => r.userId);
}
