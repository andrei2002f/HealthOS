import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { coachMessages } from "@/lib/db/schema";

export type CoachMessage = typeof coachMessages.$inferSelect;

export async function getCoachMessages(userId: string): Promise<CoachMessage[]> {
  return db
    .select()
    .from(coachMessages)
    .where(eq(coachMessages.userId, userId))
    .orderBy(asc(coachMessages.createdAt));
}

export async function appendCoachMessage(input: {
  userId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  await db.insert(coachMessages).values(input);
}

export async function clearCoachMessages(userId: string): Promise<void> {
  await db.delete(coachMessages).where(eq(coachMessages.userId, userId));
}
