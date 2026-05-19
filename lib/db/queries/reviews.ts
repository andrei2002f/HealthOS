import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { weeklyReviews } from "@/lib/db/schema";

export type WeeklyReview = typeof weeklyReviews.$inferSelect;

export async function getWeeklyReviews(userId: string): Promise<WeeklyReview[]> {
  return db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.userId, userId))
    .orderBy(desc(weeklyReviews.weekStart));
}

export async function getWeeklyReview(
  userId: string,
  reviewId: string,
): Promise<WeeklyReview | undefined> {
  return db.query.weeklyReviews.findFirst({
    where: and(
      eq(weeklyReviews.userId, userId),
      eq(weeklyReviews.id, reviewId),
    ),
  });
}

export async function upsertWeeklyReview(input: {
  userId: string;
  weekStart: string; // YYYY-MM-DD
  contentMd: string;
}): Promise<WeeklyReview> {
  const [row] = await db
    .insert(weeklyReviews)
    .values({
      userId: input.userId,
      weekStart: input.weekStart,
      contentMd: input.contentMd,
      generatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.userId, weeklyReviews.weekStart],
      set: {
        contentMd: input.contentMd,
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
