import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 request proxy (formerly `middleware`). Refreshes the Supabase
 * session and enforces the auth gate + email allowlist.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on every request except Next.js internals, static assets, and the
   * health endpoints.
   *
   * `api/health` is excluded deliberately rather than merely allowlisted as a
   * public path: `updateSession` calls `supabase.auth.getUser()`, which is a
   * network round-trip to Supabase Auth on every single request. Leaving the
   * probes inside it would make the liveness check depend on a third party —
   * so an Auth outage would fail liveness, restart every pod, and turn someone
   * else's incident into a CrashLoopBackOff of our own making.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
