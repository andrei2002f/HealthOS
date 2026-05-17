"use server";

import { redirect } from "next/navigation";

import { deleteWhoopCredentials } from "@/lib/db/queries/whoop";
import { createClient } from "@/lib/supabase/server";
import { syncWhoop } from "@/lib/whoop/sync";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function syncNow(): Promise<void> {
  const user = await requireUser();
  try {
    await syncWhoop(user.id);
  } catch {
    redirect("/settings?sync_error=1");
  }
  redirect("/settings?synced=1");
}

export async function disconnectWhoop(): Promise<void> {
  const user = await requireUser();
  await deleteWhoopCredentials(user.id);
  redirect("/settings");
}
