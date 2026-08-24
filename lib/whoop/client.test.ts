import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Type-only, so it is erased before the mock below replaces the module.
import type { WhoopCredentialRow } from "@/lib/db/queries/whoop";

/**
 * The Whoop client's job is everything around the request: deciding when a
 * token is too close to expiry, backing off a rate limit, and walking the
 * pagination cursor to the end. None of that had a test, and all of it fails
 * silently in production — a token refreshed too late means a sync that returns
 * 401 at 3am, and a pagination loop that stops early means missing data with no
 * error anywhere.
 *
 * The mock boundary is `fetch` and the modules this one imports. Whoop's HTTP
 * API is not ours, so nothing here asserts the shape of their responses beyond
 * what the client itself depends on.
 */

vi.mock("@/lib/env", () => ({
  env: { WHOOP_API_HOSTNAME: "https://api.test" },
}));

// Reversible stand-ins: the real implementation is AES-GCM, and what matters
// here is only that the client encrypts before storing and decrypts before use.
vi.mock("@/lib/crypto", () => ({
  encrypt: (value: string) => `enc(${value})`,
  decrypt: (value: string) => value.replace(/^enc\((.*)\)$/, "$1"),
}));

vi.mock("@/lib/db/queries/whoop", () => ({
  getWhoopCredentials: vi.fn(),
  updateWhoopTokens: vi.fn(),
}));

vi.mock("@/lib/whoop/oauth", () => ({
  refreshAccessToken: vi.fn(),
}));

const { getWhoopCredentials, updateWhoopTokens } = await import(
  "@/lib/db/queries/whoop"
);
const { refreshAccessToken } = await import("@/lib/whoop/oauth");
const { WhoopClient } = await import("./client");

const USER = "user-1";
const MINUTE = 60 * 1000;

function credentials(expiresInMs: number): WhoopCredentialRow {
  return {
    userId: USER,
    accessTokenEncrypted: "enc(current-token)",
    refreshTokenEncrypted: "enc(refresh-token)",
    expiresAt: new Date(Date.now() + expiresInMs),
    scopes: ["read:recovery"],
    lastSyncedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(getWhoopCredentials).mockResolvedValue(credentials(60 * MINUTE));
  vi.mocked(updateWhoopTokens).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function authHeaderOf(call: number): string {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

describe("token handling", () => {
  it("uses the stored token when it is comfortably valid", async () => {
    vi.mocked(getWhoopCredentials).mockResolvedValue(credentials(60 * MINUTE));
    fetchMock.mockResolvedValue(json({ ok: true }));

    await new WhoopClient(USER).request("/developer/v2/cycle");

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(authHeaderOf(0)).toBe("Bearer current-token");
  });

  it("refreshes once the token has under ten minutes left", async () => {
    vi.mocked(getWhoopCredentials).mockResolvedValue(credentials(9 * MINUTE));
    vi.mocked(refreshAccessToken).mockResolvedValue({
      access_token: "fresh-token",
      refresh_token: "fresh-refresh",
      expires_in: 3600,
      token_type: "bearer",
      scope: "read:recovery",
    });
    fetchMock.mockResolvedValue(json({ ok: true }));

    await new WhoopClient(USER).request("/developer/v2/cycle");

    expect(refreshAccessToken).toHaveBeenCalledWith("refresh-token");
    expect(authHeaderOf(0)).toBe("Bearer fresh-token");
  });

  it("does not refresh a token with more than ten minutes left", async () => {
    vi.mocked(getWhoopCredentials).mockResolvedValue(credentials(11 * MINUTE));
    fetchMock.mockResolvedValue(json({ ok: true }));

    await new WhoopClient(USER).request("/developer/v2/cycle");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("persists both new tokens encrypted, never in clear text", async () => {
    vi.mocked(getWhoopCredentials).mockResolvedValue(credentials(1 * MINUTE));
    vi.mocked(refreshAccessToken).mockResolvedValue({
      access_token: "fresh-token",
      refresh_token: "fresh-refresh",
      expires_in: 3600,
      token_type: "bearer",
      scope: "read:recovery",
    });
    fetchMock.mockResolvedValue(json({ ok: true }));

    await new WhoopClient(USER).request("/developer/v2/cycle");

    const [, stored] = vi.mocked(updateWhoopTokens).mock.calls[0];
    expect(stored.accessTokenEncrypted).toBe("enc(fresh-token)");
    expect(stored.refreshTokenEncrypted).toBe("enc(fresh-refresh)");
    // Whoop rotates the refresh token on every use; storing the old one would
    // break the next refresh.
    expect(stored.refreshTokenEncrypted).not.toBe("enc(refresh-token)");
  });

  it("fails loudly when the account has never been connected", async () => {
    vi.mocked(getWhoopCredentials).mockResolvedValue(undefined);

    await expect(new WhoopClient(USER).request("/x")).rejects.toThrow(
      /No Whoop credentials/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  it("retries a 429 with exponential backoff and then succeeds", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(json({ error: "slow down" }, 429))
      .mockResolvedValueOnce(json({ error: "slow down" }, 429))
      .mockResolvedValueOnce(json({ records: [], next_token: null }));

    const pending = new WhoopClient(USER).request("/developer/v2/cycle");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ records: [], next_token: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("waits 1s then 2s, not a flat interval", async () => {
    vi.useFakeTimers();
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.stubGlobal(
      "setTimeout",
      ((fn: () => void, ms?: number) => {
        if (ms) delays.push(ms);
        return realSetTimeout(fn, ms);
      }) as typeof setTimeout,
    );

    fetchMock
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ ok: true }));

    const pending = new WhoopClient(USER).request("/x");
    await vi.runAllTimersAsync();
    await pending;

    expect(delays).toEqual([1000, 2000]);
  });

  it("gives up after three attempts on a sustained 429", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(json({}, 429));

    const pending = new WhoopClient(USER).request("/x");
    const assertion = expect(pending).rejects.toThrow(
      /rate limit exceeded after 3 retries/,
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-429 failure", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    await expect(new WhoopClient(USER).request("/x")).rejects.toThrow(
      /failed \(500\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("pagination", () => {
  async function collect<T>(iterator: AsyncGenerator<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const item of iterator) out.push(item);
    return out;
  }

  it("follows next_token until the cursor is exhausted", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ records: [{ id: 1 }], next_token: "t2" }))
      .mockResolvedValueOnce(json({ records: [{ id: 2 }], next_token: "t3" }))
      .mockResolvedValueOnce(json({ records: [{ id: 3 }], next_token: null }));

    const records = await collect(
      new WhoopClient(USER).paginate<{ id: number }>("/developer/v2/cycle"),
    );

    expect(records).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops after one request when there is no next page", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ records: [{ id: 1 }], next_token: null }),
    );

    await collect(new WhoopClient(USER).paginate("/developer/v2/cycle"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * The incremental sync passes `start`. Dropping it after the first page would
   * silently pull the full history again — the exact failure that made syncs
   * exceed the serverless time limit.
   */
  it("keeps the caller's params on every page, alongside the cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ records: [], next_token: "t2" }))
      .mockResolvedValueOnce(json({ records: [], next_token: null }));

    await collect(
      new WhoopClient(USER).paginate("/developer/v2/cycle", {
        start: "2026-08-01T00:00:00.000Z",
      }),
    );

    const first = new URL(fetchMock.mock.calls[0][0] as string);
    const second = new URL(fetchMock.mock.calls[1][0] as string);

    expect(first.searchParams.get("start")).toBe("2026-08-01T00:00:00.000Z");
    expect(first.searchParams.get("nextToken")).toBeNull();

    expect(second.searchParams.get("start")).toBe("2026-08-01T00:00:00.000Z");
    expect(second.searchParams.get("nextToken")).toBe("t2");
  });

  it("yields nothing without failing when the account has no records", async () => {
    fetchMock.mockResolvedValueOnce(json({ records: [], next_token: null }));

    await expect(
      collect(new WhoopClient(USER).paginate("/developer/v2/cycle")),
    ).resolves.toEqual([]);
  });
});
