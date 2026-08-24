/**
 * Which database the integration suite talks to, and a guard that it is never
 * a real one.
 *
 * The suite truncates every table between tests. Pointing it at the hosted
 * Supabase project would destroy the actual data, so the connection string is
 * read from TEST_DATABASE_URL — deliberately a different variable from
 * DATABASE_URL — and checked before anything connects.
 */

/** Matches the postgres service in docker-compose.yml. */
const DEFAULT_TEST_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/healthos";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

/**
 * Refuses anything that is not an obviously local database.
 *
 * `postgres` is allowed as a hostname because that is the service name inside a
 * Compose network and inside a GitHub Actions job container.
 */
export function assertLocalTestDatabase(url: string): void {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`TEST_DATABASE_URL is not a valid URL: ${url}`);
  }

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "postgres";

  if (!isLocal || /supabase/i.test(url)) {
    throw new Error(
      `Refusing to run the integration suite against "${hostname}".\n` +
        `These tests truncate every table. TEST_DATABASE_URL must point at a ` +
        `local, disposable database — start one with:\n\n` +
        `  docker compose --env-file .env.local up -d postgres\n`,
    );
  }
}
