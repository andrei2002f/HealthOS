/**
 * Next.js startup hook — runs once per server process, before the first
 * request is served.
 *
 * Environment validation is lazy (see `lib/env.ts`) so that `next build` does
 * not require production secrets. That trade would otherwise turn a missing
 * variable into a 500 on some later request; calling `loadEnv()` here restores
 * fail-fast startup, so a misconfigured container exits immediately and
 * visibly rather than serving errors.
 */
export async function register() {
  // Also invoked for the edge runtime, which neither has the full environment
  // nor can import a `server-only` module.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { loadEnv } = await import("@/lib/env");
  loadEnv();

  // Prometheus metrics listen on their own port, which the Service does not
  // publish — so they are unreachable from the Ingress without the
  // application having to authenticate anyone. See ADR-0025.
  const { startMetricsServer } = await import("@/lib/observability/server");
  startMetricsServer();
}
