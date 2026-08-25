import "server-only";

import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

/**
 * Domain metrics, in Prometheus format.
 *
 * Deliberately not request-rate dashboards. This application has one user, so
 * RED metrics on HTTP would be decoration. What has actually broken here is
 * background work: a Whoop sync whose duration crept from 18s to 49s to 77s
 * until the serverless time limit killed it mid-run, leaving rows stuck at
 * `status="running"` with no error anywhere.
 *
 * That incident is the design brief. A duration histogram plus an alert would
 * have caught it weeks before it failed, because the growth was already in the
 * data. See docs/DECISIONS.md, ADR-0024.
 */

export const registry = new Registry();

/**
 * Next re-imports modules on hot reload, and prom-client throws when a metric
 * name is registered twice. Reusing the existing instance keeps `pnpm dev`
 * from crashing on the second save.
 */
function reuse<T>(name: string, create: () => T): T {
  return (registry.getSingleMetric(name) as T | undefined) ?? create();
}

let defaultsCollected = false;
if (!defaultsCollected) {
  // Heap size, event loop lag, GC pauses, open handles. These are the metrics
  // worth having when diagnosing an OOMKill or a latency complaint, and they
  // are the concrete reason prom-client earns its place over sixty lines of
  // hand-written text format.
  collectDefaultMetrics({ register: registry, prefix: "healthos_" });
  defaultsCollected = true;
}

// ─── Whoop sync ──────────────────────────────────────────────────────────────

/**
 * Buckets chosen from the real incident rather than from a default ladder.
 * The failure happened at the 60s serverless limit, and the run before it took
 * 49s — so the interesting resolution is between 30 and 90 seconds, and an
 * alert at 45 fires while there is still time to act.
 */
export const syncDuration = reuse(
  "healthos_whoop_sync_duration_seconds",
  () =>
    new Histogram({
      name: "healthos_whoop_sync_duration_seconds",
      help: "Wall-clock duration of a full Whoop sync run",
      buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120],
      registers: [registry],
    }),
);

export const syncRecords = reuse(
  "healthos_whoop_sync_records_total",
  () =>
    new Counter({
      name: "healthos_whoop_sync_records_total",
      help: "Records upserted by Whoop syncs, by resource",
      labelNames: ["resource"] as const,
      registers: [registry],
    }),
);

export const syncFailures = reuse(
  "healthos_whoop_sync_failures_total",
  () =>
    new Counter({
      name: "healthos_whoop_sync_failures_total",
      help: "Whoop sync runs that ended in an error",
      registers: [registry],
    }),
);

/**
 * Unix seconds of the last successful sync.
 *
 * The one metric that catches silent death: a cron that stops firing produces
 * no failures at all, so a failure counter stays flat and everything looks
 * healthy. Time since last success is the only signal that rises when nothing
 * happens — which is exactly what happened when a sub-daily cron expression
 * made every Vercel deploy fail for five months.
 */
export const syncLastSuccess = reuse(
  "healthos_whoop_sync_last_success_timestamp_seconds",
  () =>
    new Gauge({
      name: "healthos_whoop_sync_last_success_timestamp_seconds",
      help: "Unix timestamp of the last successful Whoop sync",
      registers: [registry],
    }),
);

// ─── Whoop API client ────────────────────────────────────────────────────────

export const tokenRefreshes = reuse(
  "healthos_whoop_token_refresh_total",
  () =>
    new Counter({
      name: "healthos_whoop_token_refresh_total",
      help: "Whoop OAuth access-token refreshes, by outcome",
      labelNames: ["outcome"] as const,
      registers: [registry],
    }),
);

export const rateLimited = reuse(
  "healthos_whoop_rate_limited_total",
  () =>
    new Counter({
      name: "healthos_whoop_rate_limited_total",
      help: "Whoop API responses that returned 429",
      registers: [registry],
    }),
);

// ─── Anthropic ───────────────────────────────────────────────────────────────

export const anthropicDuration = reuse(
  "healthos_anthropic_request_duration_seconds",
  () =>
    new Histogram({
      name: "healthos_anthropic_request_duration_seconds",
      help: "Time to first byte for Anthropic calls, by operation",
      labelNames: ["operation"] as const,
      buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [registry],
    }),
);

export const anthropicFailures = reuse(
  "healthos_anthropic_failures_total",
  () =>
    new Counter({
      name: "healthos_anthropic_failures_total",
      help: "Anthropic calls that ended in an error, by operation",
      labelNames: ["operation"] as const,
      registers: [registry],
    }),
);

/** Times an async operation and records it, whatever the outcome. */
export async function timed<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  work: () => Promise<T>,
): Promise<T> {
  const stop = histogram.startTimer(labels);
  try {
    return await work();
  } finally {
    stop();
  }
}
