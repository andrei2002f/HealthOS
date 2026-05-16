import "server-only";

import { z } from "zod";

/**
 * Server-side environment variables, validated once at import.
 *
 * Do NOT import this module from Client Components — it is guarded by
 * `server-only` and references secrets that are never sent to the browser.
 * Client code should read `NEXT_PUBLIC_*` values from `process.env` directly.
 */
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  // Whoop
  WHOOP_CLIENT_ID: z.string().min(1),
  WHOOP_CLIENT_SECRET: z.string().min(1),
  WHOOP_REDIRECT_URI: z.string().url(),
  WHOOP_API_HOSTNAME: z.string().url().default("https://api.prod.whoop.com"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),

  // Whoop MCP (AI coach) — optional; empty strings are treated as unset.
  WHOOP_MCP_URL: z.string().url().optional().or(z.literal("")),
  WHOOP_MCP_AUTH_TOKEN: z.string().optional().or(z.literal("")),

  // App
  ALLOWED_EMAIL: z.string().email(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
