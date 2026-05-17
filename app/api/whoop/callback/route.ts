import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { encrypt } from "@/lib/crypto";
import { upsertWhoopCredentials } from "@/lib/db/queries/whoop";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/whoop/oauth";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("[whoop/callback] Whoop denied access:", error);
    return NextResponse.redirect(`${APP_URL}/settings?error=whoop_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings?error=whoop_invalid`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("whoop_oauth_state")?.value;
  cookieStore.delete("whoop_oauth_state");

  if (!savedState || savedState !== state) {
    console.error("[whoop/callback] OAuth state mismatch — possible CSRF");
    return NextResponse.redirect(`${APP_URL}/settings?error=whoop_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  try {
    const tokens = await exchangeCode(code);

    await upsertWhoopCredentials({
      userId: user.id,
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(" "),
    });
  } catch (err) {
    console.error("[whoop/callback] Token exchange failed:", err);
    return NextResponse.redirect(`${APP_URL}/settings?error=whoop_exchange`);
  }

  return NextResponse.redirect(`${APP_URL}/settings?connected=1`);
}
