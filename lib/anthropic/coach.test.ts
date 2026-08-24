import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where to put the mock for a non-deterministic dependency.
 *
 * The rule this file follows: mock at the narrowest seam you own, immediately
 * below the code under test. Here that is `getAnthropic()` — our function,
 * returning the SDK client. Everything below it belongs to Anthropic.
 *
 * The two tempting alternatives are both worse.
 *
 * Mocking lower, at `fetch`, would mean hand-writing Anthropic's SSE wire
 * format. That is a reimplementation of someone else's protocol: it passes
 * while the real integration is broken if they change the wire format, and it
 * breaks on an SDK upgrade that changed nothing we depend on. A test that fails
 * for reasons unrelated to our code stops being trusted.
 *
 * Mocking higher, at `streamCoachReply` itself, would leave nothing under test.
 *
 * What is left to verify is exactly the part we wrote: that the right context
 * and history are assembled into the request, and that the model's token stream
 * is translated into well-formed SSE — including when it fails halfway. The
 * quality of what the model says is not a property a test can assert, and no
 * attempt is made to.
 */

const create = vi.fn();

vi.mock("./client", () => ({
  getAnthropic: () => ({ messages: { create } }),
  getModel: () => "claude-test-model",
}));

vi.mock("./context", () => ({
  buildUserContext: vi.fn(async () => "RECOVERY: 62\nSLEEP: 7h20m"),
}));

const { streamCoachReply } = await import("./coach");

/** Turns the SDK's chunk objects into an async iterable, as the SDK does. */
function modelStream(chunks: unknown[]) {
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}

function textDelta(text: string) {
  return { type: "content_block_delta", delta: { type: "text_delta", text } };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }

  return out;
}

const BASE = {
  userId: "user-1",
  history: [],
  userMessage: "How did I sleep?",
};

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue(modelStream([textDelta("You slept well.")]));
});

describe("request assembly", () => {
  it("sends the model id from the environment, not a hardcoded one", async () => {
    await streamCoachReply(BASE);

    expect(create.mock.calls[0][0].model).toBe("claude-test-model");
  });

  it("puts the user's health data in the system prompt", async () => {
    await streamCoachReply(BASE);

    expect(create.mock.calls[0][0].system).toContain("RECOVERY: 62");
    expect(create.mock.calls[0][0].system).toContain("USER DATA CONTEXT");
  });

  it("appends the new message after the history", async () => {
    await streamCoachReply({
      ...BASE,
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });

    const { messages } = create.mock.calls[0][0];
    expect(messages).toHaveLength(3);
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "How did I sleep?",
    });
  });

  /**
   * Context has to stay bounded or a long conversation eventually costs more
   * per reply than it is worth, and finally exceeds the model's window.
   */
  it("caps history at the last 30 messages", async () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `message ${i}`,
    }));

    await streamCoachReply({ ...BASE, history });

    const { messages } = create.mock.calls[0][0];
    // 30 kept from history, plus the new message.
    expect(messages).toHaveLength(31);
    expect(messages[0].content).toBe("message 20");
  });

  it("requests a streamed response", async () => {
    await streamCoachReply(BASE);

    expect(create.mock.calls[0][0].stream).toBe(true);
  });
});

describe("SSE translation", () => {
  it("emits one data frame per text delta and terminates the stream", async () => {
    create.mockResolvedValue(
      modelStream([textDelta("You "), textDelta("slept "), textDelta("well.")]),
    );

    const output = await readAll(await streamCoachReply(BASE));

    expect(output).toBe(
      `data: {"text":"You "}\n\n` +
        `data: {"text":"slept "}\n\n` +
        `data: {"text":"well."}\n\n` +
        `data: [DONE]\n\n`,
    );
  });

  it("ignores chunk types that carry no text", async () => {
    create.mockResolvedValue(
      modelStream([
        { type: "message_start", message: {} },
        { type: "content_block_start", content_block: { type: "text" } },
        textDelta("Hello"),
        { type: "content_block_stop" },
        { type: "message_stop" },
      ]),
    );

    const output = await readAll(await streamCoachReply(BASE));

    expect(output).toBe(`data: {"text":"Hello"}\n\n` + `data: [DONE]\n\n`);
  });

  it("escapes text that would otherwise break the JSON frame", async () => {
    create.mockResolvedValue(
      modelStream([textDelta('He said "hi"\nthen left')]),
    );

    const output = await readAll(await streamCoachReply(BASE));
    const payload = output.split("\n\n")[0].replace("data: ", "");

    expect(JSON.parse(payload).text).toBe('He said "hi"\nthen left');
  });

  /**
   * The failure that actually matters. If the model connection drops mid-reply
   * and the stream neither emits nor closes, the browser sits on an open
   * connection showing a half-finished sentence with no indication anything
   * went wrong.
   */
  it("reports a mid-stream failure and closes rather than hanging", async () => {
    create.mockResolvedValue(
      (async function* () {
        yield textDelta("Starting");
        throw new Error("upstream connection reset");
      })(),
    );

    const output = await readAll(await streamCoachReply(BASE));

    expect(output).toContain(`data: {"text":"Starting"}`);
    expect(output).toContain("upstream connection reset");
    expect(JSON.parse(output.split("\n\n")[1].replace("data: ", ""))).toEqual({
      error: "upstream connection reset",
    });
  });

  it("closes cleanly when the model returns nothing at all", async () => {
    create.mockResolvedValue(modelStream([]));

    await expect(readAll(await streamCoachReply(BASE))).resolves.toBe(
      "data: [DONE]\n\n",
    );
  });
});
