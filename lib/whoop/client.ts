import "server-only";

import { decrypt, encrypt } from "@/lib/crypto";
import { getWhoopCredentials, updateWhoopTokens } from "@/lib/db/queries/whoop";
import { env } from "@/lib/env";
import { log } from "@/lib/observability/logger";
import { rateLimited, tokenRefreshes } from "@/lib/observability/metrics";
import { refreshAccessToken } from "@/lib/whoop/oauth";
import type { WhoopPagedResponse } from "./types";

// Read at call time, not at import: a module-level read would run during
// `next build` and make the build require the environment. See ADR-0003.
const base = () => env.WHOOP_API_HOSTNAME;

const TOKEN_REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // refresh when <10 min remaining
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class WhoopClient {
  constructor(private readonly userId: string) {}

  private async getAccessToken(): Promise<string> {
    const creds = await getWhoopCredentials(this.userId);
    if (!creds) {
      throw new Error(`No Whoop credentials for user ${this.userId}`);
    }

    const expiresIn = creds.expiresAt.getTime() - Date.now();
    if (expiresIn < TOKEN_REFRESH_THRESHOLD_MS) {
      const refreshToken = decrypt(creds.refreshTokenEncrypted);

      let tokens;
      try {
        tokens = await refreshAccessToken(refreshToken);
      } catch (err) {
        // A failed refresh is the difference between "one sync failed" and
        // "the integration is dead until someone reconnects it by hand", so
        // it is counted separately from sync failures.
        tokenRefreshes.inc({ outcome: "failure" });
        log.error("whoop.token.refresh_failed", {
          userId: this.userId,
          expiresInMs: expiresIn,
          error: err,
        });
        throw err;
      }

      tokenRefreshes.inc({ outcome: "success" });
      log.info("whoop.token.refreshed", {
        userId: this.userId,
        expiresInSeconds: tokens.expires_in,
      });

      await updateWhoopTokens(this.userId, {
        accessTokenEncrypted: encrypt(tokens.access_token),
        refreshTokenEncrypted: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });
      return tokens.access_token;
    }

    return decrypt(creds.accessTokenEncrypted);
  }

  async request<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(`${base()}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) return res.json() as Promise<T>;

      if (res.status === 429) {
        rateLimited.inc();
        if (attempt === MAX_RETRIES - 1) {
          log.warn("whoop.rate_limit.exhausted", { path, attempts: MAX_RETRIES });
          throw new Error(
            `Whoop rate limit exceeded after ${MAX_RETRIES} retries`,
          );
        }
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        log.warn("whoop.rate_limit.backoff", { path, attempt, delayMs: delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const text = await res.text();
      throw new Error(`Whoop API ${path} failed (${res.status}): ${text}`);
    }

    // Unreachable but satisfies TypeScript.
    throw new Error("Unexpected end of retry loop");
  }

  /**
   * Iterate every record across all pages. `params` (e.g. `{ start }`) are
   * applied to each request so callers can fetch incrementally; `nextToken`
   * is merged in automatically for pagination.
   */
  async *paginate<T>(
    path: string,
    params?: Record<string, string>,
  ): AsyncGenerator<T> {
    let nextToken: string | null = null;

    do {
      const query = new URLSearchParams(params);
      if (nextToken) query.set("nextToken", nextToken);
      const qs = query.toString();
      const url = qs ? `${path}?${qs}` : path;

      const page: WhoopPagedResponse<T> =
        await this.request<WhoopPagedResponse<T>>(url);
      for (const record of page.records) yield record;
      nextToken = page.next_token;
    } while (nextToken);
  }
}
