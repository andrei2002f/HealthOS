/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * `import "server-only"` is a build-time guard: Next resolves it to a module
 * that throws if a Client Component pulls it in, which is how server code is
 * prevented from reaching the browser bundle. A test runner has no client
 * bundle and no bundler resolution for it, so the import is aliased here to
 * this empty module. Nothing is weakened — the guard still applies to the real
 * build, which is the only place it means anything.
 */
export {};
