import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { dailyCheckins } from "@/lib/db/schema";

export type CheckinRow = typeof dailyCheckins.$inferSelect;

export async function getCheckin(
  userId: string,
  date: string, // YYYY-MM-DD
): Promise<CheckinRow | undefined> {
  return db.query.dailyCheckins.findFirst({
    where: and(
      eq(dailyCheckins.userId, userId),
      eq(dailyCheckins.checkDate, date),
    ),
  });
}

export type UpsertCheckinInput = {
  userId: string;
  checkDate: string; // YYYY-MM-DD
  mood: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  painAreas: string[];
  notes: string | null;
};

export async function upsertCheckin(input: UpsertCheckinInput): Promise<void> {
  await db
    .insert(dailyCheckins)
    .values(input)
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.checkDate],
      set: {
        mood: input.mood,
        energy: input.energy,
        soreness: input.soreness,
        stress: input.stress,
        painAreas: input.painAreas,
        notes: input.notes,
        updatedAt: new Date(),
      },
    });
}
