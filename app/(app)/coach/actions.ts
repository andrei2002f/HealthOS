"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { clearCoachMessages } from "@/lib/db/queries/coach";

export async function clearConversation(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated." };

  await clearCoachMessages(user.id);
  revalidatePath("/coach");
  return { ok: true };
}
