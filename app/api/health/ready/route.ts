import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How long a probe result is reused. Kubernetes probes this pod every few
 * seconds; without a cache, the readiness check alone would open a connection
 * to Postgres several times a minute per pod, forever, to learn something that
 * changes rarely.
 */
const CACHE_TTL_MS = 5_000;

/**
 * A probe that hangs is worse than one that fails: Kubernetes would wait out
 * `timeoutSeconds` before deciding, delaying the pod's removal from service.
 * Failing fast and explicitly is the useful behaviour.
 */
const QUERY_TIMEOUT_MS = 2_000;

type ProbeResult = { ok: boolean; error?: string };

let cached: { at: number; result: ProbeResult } | null = null;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`database did not respond within ${ms}ms`)),
      ms,
    );
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    // The losing promise may still reject later; swallow it so it does not
    // surface as an unhandled rejection and take the process down.
    void Promise.resolve(work).catch(() => {});
  }
}

async function checkDatabase(): Promise<ProbeResult> {
  const now = Date.now();

  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  let result: ProbeResult;

  try {
    await withTimeout(db.execute(sql`select 1`), QUERY_TIMEOUT_MS);
    result = { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health/ready] database check failed:", message);
    result = { ok: false, error: message };
  }

  cached = { at: now, result };
  return result;
}

/**
 * Readiness probe — "can this pod serve a request right now?"
 *
 * Unlike liveness, this is allowed to depend on the database, because failing
 * it removes the pod from the Service's endpoints rather than restarting it.
 * When Postgres comes back, the pod returns to service on its own with no
 * restart and no lost process state.
 *
 * The trade-off, stated plainly: with few replicas, every pod failing this at
 * once means the Ingress returns 503 for everything — including pages that
 * need no database at all, such as /login and the PWA shell. That is the
 * accepted cost of a clear signal over a half-working site. See ADR-0012.
 */
export async function GET(): Promise<NextResponse> {
  const database = await checkDatabase();

  if (!database.ok) {
    return NextResponse.json(
      { ok: false, error: "not ready", data: { database: database.error } },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: { status: "ready", database: "ok" },
  });
}
