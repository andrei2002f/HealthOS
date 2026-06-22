"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();
const passwordSchema = z.string().min(1);

/**
 * Email + password sign-in. Enforces the single-user `ALLOWED_EMAIL` gate
 * before touching Supabase. The password is set out-of-band via
 * `scripts/set-password.mjs` (no email required).
 */
export async function signInWithPassword(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!email.success || !password.success) {
    redirect("/login?error=invalid_credentials");
  }

  if (email.data.toLowerCase() !== env.ALLOWED_EMAIL.toLowerCase()) {
    redirect("/login?error=not_allowed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/");
}

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
