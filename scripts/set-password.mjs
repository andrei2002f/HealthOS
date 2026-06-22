// One-off: set a password for the ALLOWED_EMAIL user via the Supabase Admin API.
// Sends NO email (bypasses the magic-link rate limit). Run locally only.
//
//   node scripts/set-password.mjs "your-new-password"
//
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ALLOWED_EMAIL
// in .env.local. The service role key is server-only — never commit it.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ALLOWED_EMAIL;
const password = process.argv[2];

if (!url || !serviceKey || !email) {
  console.error(
    "Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_EMAIL in .env.local",
  );
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Usage: node scripts/set-password.mjs "password" (min 8 chars)');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find the existing user by email (paginated; single-user app, page 1 is enough).
const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error("listUsers failed:", error.message);
  process.exit(1);
}

const user = data.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);
if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password,
});
if (updateError) {
  console.error("updateUserById failed:", updateError.message);
  process.exit(1);
}

console.log(`Password set for ${email} (uid ${user.id}). Account data unchanged.`);
