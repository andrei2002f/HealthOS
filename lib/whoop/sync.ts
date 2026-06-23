import "server-only";

import {
  getWhoopCredentials,
  insertSyncLog,
  markWhoopSynced,
  updateSyncLog,
  upsertCycle,
  upsertRecovery,
  upsertSleep,
  upsertWorkout,
} from "@/lib/db/queries/whoop";
import { autoCreateBasketballSessions } from "@/lib/db/queries/basketball";

import { WhoopClient } from "./client";
import type { WhoopCycle, WhoopRecovery, WhoopSleep, WhoopWorkout } from "./types";

export type SyncResult = {
  cycles: number;
  recovery: number;
  sleep: number;
  workouts: number;
};

// Re-fetch a window before the last sync so late-arriving or recomputed
// records (recovery scores land hours later, sleep can be edited) aren't
// missed. Upserts are idempotent on Whoop's id, so overlap is harmless.
const SYNC_OVERLAP_MS = 3 * 24 * 60 * 60 * 1000;

export async function syncWhoop(userId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const { id: logId } = await insertSyncLog({
    userId,
    job: "whoop_sync",
    status: "running",
    startedAt,
  });

  // Incremental: only fetch records since the last successful sync (minus an
  // overlap window). A full-history pull grows unbounded and eventually
  // exceeds the serverless time limit; this keeps each run small and fast.
  const creds = await getWhoopCredentials(userId);
  const params = creds?.lastSyncedAt
    ? {
        start: new Date(
          creds.lastSyncedAt.getTime() - SYNC_OVERLAP_MS,
        ).toISOString(),
      }
    : undefined;

  const client = new WhoopClient(userId);
  const result: SyncResult = { cycles: 0, recovery: 0, sleep: 0, workouts: 0 };

  try {
    for await (const cycle of client.paginate<WhoopCycle>(
      "/developer/v2/cycle",
      params,
    )) {
      await upsertCycle(userId, cycle);
      result.cycles++;
    }

    for await (const rec of client.paginate<WhoopRecovery>(
      "/developer/v2/recovery",
      params,
    )) {
      await upsertRecovery(userId, rec);
      result.recovery++;
    }

    for await (const sleep of client.paginate<WhoopSleep>(
      "/developer/v2/activity/sleep",
      params,
    )) {
      await upsertSleep(userId, sleep);
      result.sleep++;
    }

    for await (const workout of client.paginate<WhoopWorkout>(
      "/developer/v2/activity/workout",
      params,
    )) {
      await upsertWorkout(userId, workout);
      result.workouts++;
    }

    // Materialise a basketball session for each new Whoop basketball workout.
    await autoCreateBasketballSessions(userId);

    const total =
      result.cycles + result.recovery + result.sleep + result.workouts;

    await updateSyncLog(logId, {
      status: "success",
      recordsSynced: total,
      finishedAt: new Date(),
    });
    await markWhoopSynced(userId);

    console.log(
      `[whoop/sync] user=${userId} cycles=${result.cycles} recovery=${result.recovery} sleep=${result.sleep} workouts=${result.workouts}`,
    );

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[whoop/sync] user=${userId} error:`, message);

    await updateSyncLog(logId, {
      status: "error",
      finishedAt: new Date(),
      error: message,
    });

    throw err;
  }
}
