import "server-only";

import { createServer, type Server } from "node:http";

import { log } from "./logger";
import { registry, syncLastSuccess } from "./metrics";

/**
 * Serves Prometheus metrics on a port of their own, separate from the one that
 * serves users.
 *
 * The first attempt put this at `/api/metrics` and denied the path at the
 * Ingress with an nginx `server-snippet`. That does not work: ingress-nginx
 * ships with `allow-snippet-annotations: false` since v1.9, because a snippet
 * lets anyone who can create an Ingress inject arbitrary nginx configuration —
 * a privilege escalation on a shared cluster. Turning it back on would have
 * weakened a cluster-wide default to solve a local problem.
 *
 * A separate port is the standard answer and a stronger one. The Service
 * publishes only 3000, so nothing reachable through the Ingress can route
 * here at all; Prometheus scrapes the pod IP directly on this port. The
 * application still authenticates nobody — exposure is decided by what the
 * Service publishes, which is where that decision belongs.
 *
 * See docs/DECISIONS.md, ADR-0025.
 */

const DEFAULT_PORT = 9091;

let server: Server | undefined;

/**
 * Restores `last successful sync` from the database at startup.
 *
 * Without this the gauge reads 0 in a freshly started pod, which the alert
 * interprets as "no sync since 1970" and fires falsely after every restart.
 * Deliberately best-effort: metrics must never be the reason a boot fails, so
 * a database that is not ready yet is logged and moved past.
 */
async function seedLastSuccessfulSync(): Promise<void> {
  try {
    const { getLastSuccessfulSyncAt } = await import("@/lib/db/queries/whoop");
    const lastSuccess = await getLastSuccessfulSyncAt();

    if (lastSuccess) {
      syncLastSuccess.set(lastSuccess.getTime() / 1000);
      log.info("metrics.sync_gauge_seeded", {
        lastSuccessAt: lastSuccess.toISOString(),
      });
    } else {
      log.info("metrics.sync_gauge_unseeded", { reason: "no successful sync on record" });
    }
  } catch (err) {
    log.warn("metrics.sync_gauge_seed_failed", { error: err });
  }
}

export function startMetricsServer(): void {
  // register() can run more than once under hot reload; a second listen on the
  // same port would throw EADDRINUSE and take the process down.
  if (server) return;

  const port = Number(process.env.METRICS_PORT ?? DEFAULT_PORT);

  server = createServer((req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404).end();
      return;
    }

    registry
      .metrics()
      .then((body) => {
        res.writeHead(200, {
          "Content-Type": registry.contentType,
          "Cache-Control": "no-store",
        });
        res.end(body);
      })
      .catch((err: unknown) => {
        log.error("metrics.render_failed", { error: err });
        res.writeHead(500).end();
      });
  });

  // A metrics endpoint must never be the reason the process dies.
  server.on("error", (err) => {
    log.error("metrics.server_error", { port, error: err });
  });

  // Do not hold the event loop open on this alone: if the main server exits,
  // the process should follow rather than linger serving metrics about
  // nothing.
  server.unref();

  server.listen(port, () => {
    log.info("metrics.server_listening", { port, path: "/metrics" });
  });

  // Not awaited: the server should accept scrapes immediately, and an
  // unseeded gauge is corrected a moment later rather than delaying startup.
  void seedLastSuccessfulSync();
}
