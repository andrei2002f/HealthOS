"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { upsertCheckin } from "@/lib/db/queries/checkin";

const PAIN_AREAS = [
  "knee_left",
  "knee_right",
  "lower_back",
  "upper_back",
  "shoulder_left",
  "shoulder_right",
  "hip_left",
  "hip_right",
  "ankle_left",
  "ankle_right",
  "neck",
  "wrist_left",
  "wrist_right",
] as const;

const checkinSchema = z.object({
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  soreness: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5),
  painAreas: z.array(z.enum(PAIN_AREAS)).default([]),
  notes: z.string().max(2000).optional(),
});

export type CheckinActionState =
  | { ok: true }
  | { ok: false; error: string };

export async function submitCheckin(
  _prev: CheckinActionState,
  formData: FormData,
): Promise<CheckinActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated." };

  const raw = {
    checkDate: formData.get("checkDate"),
    mood: formData.get("mood"),
    energy: formData.get("energy"),
    soreness: formData.get("soreness"),
    stress: formData.get("stress"),
    painAreas: formData.getAll("painAreas"),
    notes: formData.get("notes") ?? undefined,
  };

  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  await upsertCheckin({
    userId: user.id,
    checkDate: data.checkDate,
    mood: data.mood,
    energy: data.energy,
    soreness: data.soreness,
    stress: data.stress,
    painAreas: data.painAreas as string[],
    notes: data.notes ?? null,
  });

  revalidatePath("/");
  revalidatePath("/checkin");

  return { ok: true };
}
