import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * `import "server-only"` is a build-time guard that Next resolves to a module
 * throwing if a Client Component imports it. Vitest has no client bundle and no
 * such resolution, so it is aliased to an empty module. The guard still applies
 * to the real build, which is the only place it does anything.
 */
const serverOnlyStub = fileURLToPath(
  new URL("./lib/db/__test__/server-only-stub.ts", import.meta.url),
);

const resolve = {
  // Vite resolves the `@/*` paths from tsconfig.json natively.
  tsconfigPaths: true,
  alias: { "server-only": serverOnlyStub },
};

/**
 * Two suites, separated because they have incompatible costs.
 *
 * `unit` runs in milliseconds against pure functions and mocked boundaries, so
 * it can run on every save. `integration` needs a live Postgres, applies the
 * migration chain once, and runs serially.
 *
 * Splitting them keeps the fast loop fast and lets CI fail on the cheap suite
 * before spending time standing up a database.
 */
export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts"],
          exclude: ["lib/**/*.integration.test.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["lib/**/*.integration.test.ts"],
          // Applies the auth shim and the migration chain once for the suite.
          globalSetup: ["lib/db/__test__/global-setup.ts"],
          setupFiles: ["lib/db/__test__/setup.ts"],
          // The suites share one database and truncate between tests, so they
          // must not run concurrently.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
