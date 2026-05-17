import "server-only";

import {
  insertSyncLog,
  markWhoopSynced,
  updateSyncLog,
  upsertCycle,
  upsertRecovery,
  upsertSleep,
  upsertWorkout,
} from "@/lib/db/queries/whoop";

import { WhoopClient } from "./client";
import type { WhoopCycle, WhoopRecovery, WhoopSleep, WhoopWorkout } from "./types";

export type SyncResult = {
  cycles: number;
  recovery: number;
  sleep: number;
  workouts: number;
};

export async function syncWhoop(userId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const { id: logId } = await insertSyncLog({
    userId,
    job: "whoop_sync",
    status: "running",
    startedAt,
  });

  const client = new WhoopClient(userId);
  const result: SyncResult = { cycles: 0, recovery: 0, sleep: 0, workouts: 0 };

  try {
    for await (const cycle of client.paginate<WhoopCycle>("/v2/cycle")) {
      await upsertCycle(userId, cycle);
      result.cycles++;
    }

    for await (const rec of client.paginate<WhoopRecovery>("/v2/recovery")) {
      await upsertRecovery(userId, rec);
      result.recovery++;
    }

    for await (const sleep of client.paginate<WhoopSleep>(
      "/v2/activity/sleep",
    )) {
      await upsertSleep(userId, sleep);
      result.sleep++;
    }

    for await (const workout of client.paginate<WhoopWorkout>(
      "/v2/activity/workout",
    )) {
      await upsertWorkout(userId, workout);
      result.workouts++;
    }

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
