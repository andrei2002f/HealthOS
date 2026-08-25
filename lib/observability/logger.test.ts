import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "./logger";

/**
 * Redaction is the part of this logger worth testing.
 *
 * CLAUDE.md forbids logging Whoop tokens, API keys, or the user's email, and
 * that rule currently lives in a developer's memory — one `log.info("x", creds)`
 * away from being broken silently. These tests turn it into something that
 * fails a build.
 */

let stdout: string[];
let stderr: string[];

function lastLine(stream: string[]): Record<string, unknown> {
  return JSON.parse(stream[stream.length - 1]);
}

beforeEach(() => {
  stdout = [];
  stderr = [];
  vi.stubGlobal("process", {
    ...process,
    env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "debug" },
    stdout: { write: (s: string) => stdout.push(s.trim()) },
    stderr: { write: (s: string) => stderr.push(s.trim()) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("redaction", () => {
  it("redacts anything whose key names a credential", () => {
    log.info("test", {
      accessToken: "wh_live_abc123",
      refreshToken: "wh_refresh_xyz",
      apiKey: "sk-ant-secret",
      password: "hunter2",
      authorization: "Bearer abc",
      encryptionKey: "0".repeat(32),
    });

    const line = lastLine(stdout);
    for (const key of [
      "accessToken",
      "refreshToken",
      "apiKey",
      "password",
      "authorization",
      "encryptionKey",
    ]) {
      expect(line[key]).toBe("[redacted]");
    }
  });

  it("redacts the user's email, which is PII and the auth gate", () => {
    log.info("test", { email: "someone@example.com" });

    expect(lastLine(stdout).email).toBe("[redacted]");
  });

  /**
   * The case that matters most: nobody writes `log.info("x", { token })`
   * deliberately. They log a whole credentials row.
   */
  it("redacts credentials nested inside an object logged wholesale", () => {
    log.info("test", {
      creds: {
        userId: "user-1",
        accessTokenEncrypted: "enc(...)",
        refreshTokenEncrypted: "enc(...)",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const creds = lastLine(stdout).creds as Record<string, unknown>;
    expect(creds.accessTokenEncrypted).toBe("[redacted]");
    expect(creds.refreshTokenEncrypted).toBe("[redacted]");
    // Non-sensitive siblings survive, or the log would be useless.
    expect(creds.userId).toBe("user-1");
    expect(creds.expiresAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps ordinary fields intact", () => {
    log.info("whoop.sync.finished", {
      userId: "user-1",
      durationSeconds: 18.4,
      records: 47,
    });

    const line = lastLine(stdout);
    expect(line.userId).toBe("user-1");
    expect(line.durationSeconds).toBe(18.4);
    expect(line.records).toBe(47);
  });
});

describe("output shape", () => {
  it("writes one parseable JSON object per line", () => {
    log.info("some.event", { a: 1 });

    expect(stdout).toHaveLength(1);
    expect(() => JSON.parse(stdout[0])).not.toThrow();
    expect(stdout[0]).not.toContain("\n");
  });

  it("stamps a timestamp, a level and the event name", () => {
    log.info("whoop.sync.started", { userId: "u" });

    const line = lastLine(stdout);
    expect(line.level).toBe("info");
    expect(line.event).toBe("whoop.sync.started");
    expect(typeof line.ts).toBe("string");
    expect(new Date(line.ts as string).getTime()).not.toBeNaN();
  });

  it("sends warnings and errors to stderr so split streams stay meaningful", () => {
    log.warn("a.warning");
    log.error("an.error");
    log.info("an.info");

    expect(stderr).toHaveLength(2);
    expect(stdout).toHaveLength(1);
  });

  it("serialises an Error into name, message and a trimmed stack", () => {
    log.error("whoop.sync.failed", { error: new Error("connection reset") });

    const err = lastLine(stderr).error as Record<string, string>;
    expect(err.name).toBe("Error");
    expect(err.message).toBe("connection reset");
    expect(err.stack.split("\n").length).toBeLessThanOrEqual(5);
  });

  it("does not throw or hang on a cyclic object", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;

    expect(() => log.info("test", { cyclic })).not.toThrow();
  });
});

describe("child loggers", () => {
  it("stamps bound fields onto every line", () => {
    const jobLog = log.child({ job: "whoop_sync", userId: "user-1" });

    jobLog.info("whoop.sync.started");
    jobLog.info("whoop.sync.finished", { records: 12 });

    for (const raw of stdout) {
      const line = JSON.parse(raw);
      expect(line.job).toBe("whoop_sync");
      expect(line.userId).toBe("user-1");
    }
    expect(lastLine(stdout).records).toBe(12);
  });

  it("lets a call site override a bound field", () => {
    log.child({ userId: "bound" }).info("test", { userId: "explicit" });

    expect(lastLine(stdout).userId).toBe("explicit");
  });
});

describe("levels", () => {
  it("drops debug lines when LOG_LEVEL is info", () => {
    vi.stubGlobal("process", {
      ...process,
      env: { ...process.env, LOG_LEVEL: "info" },
      stdout: { write: (s: string) => stdout.push(s.trim()) },
      stderr: { write: (s: string) => stderr.push(s.trim()) },
    });

    log.debug("noisy.detail");
    log.info("worth.keeping");

    expect(stdout).toHaveLength(1);
    expect(lastLine(stdout).event).toBe("worth.keeping");
  });
});
