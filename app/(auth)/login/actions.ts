"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();

/**
 * Sends a magic-link email. Rejects any address other than `ALLOWED_EMAIL`
 * (the single-user gate) before touching Supabase.
 */
export async function sendMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect("/login?error=invalid_email");
  }

  if (parsed.data.toLowerCase() !== env.ALLOWED_EMAIL.toLowerCase()) {
    redirect("/login?error=not_allowed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect("/login?error=send_failed");
  }

  redirect("/login?sent=1");
}
