import { toZonedTime } from "date-fns-tz";
import { type NextRequest, NextResponse } from "next/server";

import { getAllWhoopUserIds } from "@/lib/db/queries/whoop";
import { env } from "@/lib/env";
import { syncWhoop } from "@/lib/whoop/sync";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby plan max

const TZ = "Europe/Bucharest";
const TARGET_LOCAL_HOUR = 7;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // Vercel Cron is UTC-only and has no DST awareness. We fire at 04:00 and
  // 05:00 UTC and run only when it's 07:00 local — so exactly one invocation
  // per day does work, year-round (04 UTC in summer, 05 UTC in winter).
  const localHour = toZonedTime(new Date(), TZ).getHours();
  if (localHour !== TARGET_LOCAL_HOUR) {
    return NextResponse.json({
      ok: true,
      data: { skipped: true, localHour },
    });
  }

  const userIds = await getAllWhoopUserIds();

  if (userIds.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { message: "No connected Whoop accounts" },
    });
  }

  const results = await Promise.allSettled(userIds.map((id) => syncWhoop(id)));

  const successes = results.filter((r) => r.status === "fulfilled").length;
  const failures = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    ok: failures === 0,
    data: { users: userIds.length, successes, failures },
  });
}
