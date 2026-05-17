import "server-only";

import { decrypt, encrypt } from "@/lib/crypto";
import { getWhoopCredentials, updateWhoopTokens } from "@/lib/db/queries/whoop";
import { env } from "@/lib/env";
import { refreshAccessToken } from "@/lib/whoop/oauth";
import type { WhoopPagedResponse } from "./types";

const BASE = env.WHOOP_API_HOSTNAME;
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
      const tokens = await refreshAccessToken(refreshToken);
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
      const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) return res.json() as Promise<T>;

      if (res.status === 429) {
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(
            `Whoop rate limit exceeded after ${MAX_RETRIES} retries`,
          );
        }
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const text = await res.text();
      throw new Error(`Whoop API ${path} failed (${res.status}): ${text}`);
    }

    // Unreachable but satisfies TypeScript.
    throw new Error("Unexpected end of retry loop");
  }

  async *paginate<T>(path: string): AsyncGenerator<T> {
    let nextToken: string | null = null;

    do {
      const url: string = nextToken
        ? `${path}?nextToken=${encodeURIComponent(nextToken)}`
        : path;
      const page: WhoopPagedResponse<T> =
        await this.request<WhoopPagedResponse<T>>(url);
      for (const record of page.records) yield record;
      nextToken = page.next_token;
    } while (nextToken);
  }
}
