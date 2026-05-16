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
  /** Run on every request except Next.js internals and static assets. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
