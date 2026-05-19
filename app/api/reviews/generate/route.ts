import { type NextRequest, NextResponse } from "next/server";

import { getAllWhoopUserIds } from "@/lib/db/queries/whoop";
import { upsertWeeklyReview } from "@/lib/db/queries/reviews";
import {
  generateWeeklyReview,
  lastCompletedWeekStart,
  toDateString,
} from "@/lib/anthropic/weekly-review";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = lastCompletedWeekStart();
  const weekStartStr = toDateString(weekStart);

  const userIds = await getAllWhoopUserIds();

  if (userIds.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { message: "No users found", weekStart: weekStartStr },
    });
  }

  const startedAt = new Date();

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const contentMd = await generateWeeklyReview(userId, weekStart);
      await upsertWeeklyReview({ userId, weekStart: weekStartStr, contentMd });
      return userId;
    }),
  );

  const successes = results.filter((r) => r.status === "fulfilled").length;
  const failures = results.filter((r) => r.status === "rejected");

  // Log to sync_logs for visibility
  await Promise.allSettled(
    userIds.map((userId, i) =>
      db.insert(syncLogs).values({
        userId,
        job: "weekly_review",
        status: results[i].status === "fulfilled" ? "success" : "error",
        startedAt,
        finishedAt: new Date(),
        error:
          results[i].status === "rejected"
            ? String((results[i] as PromiseRejectedResult).reason)
            : null,
      }),
    ),
  );

  return NextResponse.json({
    ok: failures.length === 0,
    data: {
      weekStart: weekStartStr,
      users: userIds.length,
      successes,
      failures: failures.length,
    },
  });
}
