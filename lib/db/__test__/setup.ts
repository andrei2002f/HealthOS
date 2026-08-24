import { beforeEach } from "vitest";

import { TEST_DATABASE_URL } from "./database-url";
import { truncateAll } from "./helpers";

/**
 * Per-file setup for the integration suite.
 *
 * Everything here happens before the test file — and therefore before
 * `lib/db` — is imported. That ordering is what makes it work: since Phase 1,
 * `lib/env` validates on first read and `lib/db` builds its connection pool on
 * first use, so redirecting DATABASE_URL at this point is enough to point the
 * application's own `db` instance at the test database. There is no separate
 * test client, which means the tests exercise the real wiring.
 */
process.env.DATABASE_URL = TEST_DATABASE_URL;

// `lib/env` validates the whole schema on first read, so every variable has to
// be present even though these tests touch only the database. Values are
// obviously fake; nothing here reaches a network.
const stubs: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  WHOOP_CLIENT_ID: "test-client-id",
  WHOOP_CLIENT_SECRET: "test-client-secret",
  WHOOP_REDIRECT_URI: "http://localhost:3000/api/whoop/callback",
  WHOOP_API_HOSTNAME: "http://localhost:9999",
  ANTHROPIC_API_KEY: "test-anthropic-key",
  ANTHROPIC_MODEL: "claude-test",
  ALLOWED_EMAIL: "test@example.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "test-encryption-key-at-least-32-chars-long",
  CRON_SECRET: "test-cron-secret",
};

for (const [key, value] of Object.entries(stubs)) {
  process.env[key] ??= value;
}

// A clean database per test. Cheaper and simpler than a transaction-per-test
// rollback, which would not survive the code under test opening its own
// transactions.
beforeEach(async () => {
  await truncateAll();
});
