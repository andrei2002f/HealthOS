import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Never prerendered or cached: a cached 200 would report a wedged process as
// healthy, which is the one thing this endpoint exists to prevent.
export const dynamic = "force-dynamic";

/**
 * Liveness probe — "is this process still able to answer?"
 *
 * The only remedy for a failed liveness check is a restart, so this must depend
 * on nothing outside the process. It touches no database, no Supabase Auth, no
 * third-party API. If it checked the database, an outage at Supabase would fail
 * the probe on every pod at once, Kubernetes would restart them all, and the
 * database would still be down when they came back — turning someone else's
 * incident into a self-inflicted CrashLoopBackOff.
 *
 * External dependencies belong in the readiness probe, which removes a pod from
 * service instead of killing it. See docs/DECISIONS.md, ADR-0012.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    data: {
      status: "alive",
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
}
