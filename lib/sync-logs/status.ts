/** Minimal shape needed to derive a display status; matches the Drizzle row. */
export type DisplayableSyncLog = {
  status: string;
  startedAt: Date | string;
};

/** Status stored on an abandoned run, once we know it will never finish. */
export const TIMED_OUT = "timed_out";

/**
 * A serverless timeout kills the process without running `catch`, so a row
 * written as "running" before the work never gets finalised. Every Vercel
 * function here is capped well under a minute, so anything still "running"
 * after this window is dead, not in flight.
 */
export const STALE_RUNNING_MS = 5 * 60 * 1000;

const JOB_LABELS: Record<string, string> = {
  whoop_sync: "Whoop sync",
  weekly_review: "Weekly review",
};

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/**
 * Reclassifies abandoned "running" rows as timed out. Every other status is
 * passed through untouched — this only reads, it never rewrites history.
 */
export function displaySyncStatus(
  log: DisplayableSyncLog,
  now: Date = new Date(),
): string {
  if (log.status !== "running") return log.status;

  return now.getTime() - toTime(log.startedAt) > STALE_RUNNING_MS
    ? TIMED_OUT
    : "running";
}

export function formatJob(job: string): string {
  return JOB_LABELS[job] ?? job.replace(/_/g, " ");
}
