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
import {
  toCycleRow,
  toRecoveryRow,
  toSleepRow,
  toWorkoutRow,
  updateSetFor,
} from "@/lib/whoop/mappers";
import type {
  WhoopCycle,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
} from "@/lib/whoop/types";

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

/** A cycle's identity and start instant never change once Whoop has issued it. */
const CYCLE_IMMUTABLE = ["id", "userId", "startAt"] as const;

export async function upsertCycle(
  userId: string,
  cycle: WhoopCycle,
): Promise<void> {
  const row = toCycleRow(userId, cycle);

  await db
    .insert(whoopCycles)
    .values(row)
    .onConflictDoUpdate({
      target: whoopCycles.id,
      set: updateSetFor(row, CYCLE_IMMUTABLE),
    });
}

// ─── Recovery ────────────────────────────────────────────────────────────────

/** Recovery is keyed on its cycle; both links are part of its identity. */
const RECOVERY_IMMUTABLE = ["id", "userId", "cycleId", "sleepId"] as const;

export async function upsertRecovery(
  userId: string,
  recovery: WhoopRecovery,
): Promise<void> {
  const row = toRecoveryRow(userId, recovery);

  await db
    .insert(whoopRecovery)
    .values(row)
    .onConflictDoUpdate({
      target: whoopRecovery.id,
      set: updateSetFor(row, RECOVERY_IMMUTABLE),
    });
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

/** Whether a sleep was a nap, and when it began, are fixed at creation. */
const SLEEP_IMMUTABLE = ["id", "userId", "startAt", "isNap"] as const;

export async function upsertSleep(
  userId: string,
  sleep: WhoopSleep,
): Promise<void> {
  const row = toSleepRow(userId, sleep);

  await db
    .insert(whoopSleep)
    .values(row)
    .onConflictDoUpdate({
      target: whoopSleep.id,
      set: updateSetFor(row, SLEEP_IMMUTABLE),
    });
}

// ─── Workouts ────────────────────────────────────────────────────────────────

/**
 * `sportName` is deliberately NOT immutable: SPORT_ID_MAP has been wrong before
 * (Basketball was mapped to 35 instead of 17), and re-syncing has to be able to
 * relabel rows written under the old map.
 */
const WORKOUT_IMMUTABLE = ["id", "userId", "startAt"] as const;

export async function upsertWorkout(
  userId: string,
  workout: WhoopWorkout,
): Promise<void> {
  const row = toWorkoutRow(userId, workout);

  await db
    .insert(whoopWorkouts)
    .values(row)
    .onConflictDoUpdate({
      target: whoopWorkouts.id,
      set: updateSetFor(row, WORKOUT_IMMUTABLE),
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
