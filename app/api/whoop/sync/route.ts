import { type NextRequest, NextResponse } from "next/server";

import { getAllWhoopUserIds } from "@/lib/db/queries/whoop";
import { env } from "@/lib/env";
import { syncWhoop } from "@/lib/whoop/sync";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby plan max

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
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
