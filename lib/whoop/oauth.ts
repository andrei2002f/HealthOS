import "server-only";

import { env } from "@/lib/env";
import type { WhoopTokenResponse } from "./types";

export const WHOOP_SCOPES = [
  "offline",
  "read:profile",
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:cycles",
  "read:body_measurement",
] as const;

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.WHOOP_CLIENT_ID,
    redirect_uri: env.WHOOP_REDIRECT_URI,
    response_type: "code",
    scope: WHOOP_SCOPES.join(" "),
    state,
  });
  return `${env.WHOOP_API_HOSTNAME}/oauth/oauth2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.WHOOP_REDIRECT_URI,
    client_id: env.WHOOP_CLIENT_ID,
    client_secret: env.WHOOP_CLIENT_SECRET,
  });

  const res = await fetch(`${env.WHOOP_API_HOSTNAME}/oauth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<WhoopTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.WHOOP_CLIENT_ID,
    client_secret: env.WHOOP_CLIENT_SECRET,
    scope: WHOOP_SCOPES.join(" "),
  });

  const res = await fetch(`${env.WHOOP_API_HOSTNAME}/oauth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<WhoopTokenResponse>;
}
