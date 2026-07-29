import { describe, expect, it } from "vitest";

import {
  STALE_RUNNING_MS,
  TIMED_OUT,
  displaySyncStatus,
  formatJob,
} from "./status";

const NOW = new Date("2026-07-30T12:00:00Z");

function startedMsAgo(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("displaySyncStatus", () => {
  it("keeps a recent running row as running", () => {
    const log = { status: "running", startedAt: startedMsAgo(30_000) };
    expect(displaySyncStatus(log, NOW)).toBe("running");
  });

  it("marks a running row past the window as timed out", () => {
    const log = { status: "running", startedAt: startedMsAgo(24 * 3600_000) };
    expect(displaySyncStatus(log, NOW)).toBe(TIMED_OUT);
  });

  it("keeps a row running exactly at the window boundary", () => {
    const log = { status: "running", startedAt: startedMsAgo(STALE_RUNNING_MS) };
    expect(displaySyncStatus(log, NOW)).toBe("running");
  });

  it("passes finished statuses through regardless of age", () => {
    const old = startedMsAgo(30 * 24 * 3600_000);
    expect(displaySyncStatus({ status: "success", startedAt: old }, NOW)).toBe(
      "success",
    );
    expect(displaySyncStatus({ status: "error", startedAt: old }, NOW)).toBe(
      "error",
    );
    expect(displaySyncStatus({ status: "partial", startedAt: old }, NOW)).toBe(
      "partial",
    );
  });

  it("accepts an ISO string startedAt", () => {
    const log = { status: "running", startedAt: "2026-07-01T00:00:00Z" };
    expect(displaySyncStatus(log, NOW)).toBe(TIMED_OUT);
  });
});

describe("formatJob", () => {
  it("labels known jobs", () => {
    expect(formatJob("whoop_sync")).toBe("Whoop sync");
    expect(formatJob("weekly_review")).toBe("Weekly review");
  });

  it("falls back to the underscore-free job name", () => {
    expect(formatJob("refresh_tokens")).toBe("refresh tokens");
  });
});
