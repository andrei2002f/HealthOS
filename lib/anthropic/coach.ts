import "server-only";

import { log } from "@/lib/observability/logger";
import {
  anthropicDuration,
  anthropicFailures,
} from "@/lib/observability/metrics";

import { getAnthropic, getModel } from "./client";
import { COACH_SYSTEM_PROMPT } from "./prompts";
import { buildUserContext } from "./context";

export type CoachHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamCoachReply({
  userId,
  history,
  userMessage,
}: {
  userId: string;
  history: CoachHistoryMessage[];
  userMessage: string;
}): Promise<ReadableStream<Uint8Array>> {
  const contextBlock = await buildUserContext(userId);

  const systemPrompt = `${COACH_SYSTEM_PROMPT}

=== USER DATA CONTEXT ===
${contextBlock}`;

  // Cap history to last 30 messages to keep tokens bounded
  const cappedHistory = history.slice(-30);

  const messages = [
    ...cappedHistory,
    { role: "user" as const, content: userMessage },
  ];

  // Measures time to the opening of the stream, not to the last token: that
  // is the number the user experiences as "did it hang?", and the only part
  // whose latency we can act on.
  const stopTimer = anthropicDuration.startTimer({ operation: "coach" });

  let stream;
  try {
    // Use create({stream: true}) for a raw RawMessageStreamEvent iterator —
    // simpler than the MessageStream wrapper and works reliably with for-await.
    stream = await getAnthropic().messages.create({
      model: getModel(),
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    });
  } catch (err) {
    anthropicFailures.inc({ operation: "coach" });
    log.error("anthropic.coach.request_failed", { userId, error: err });
    throw err;
  }

  log.info("anthropic.coach.stream_opened", {
    userId,
    ttfbSeconds: stopTimer(),
    historyMessages: cappedHistory.length,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        anthropicFailures.inc({ operation: "coach" });
        log.error("anthropic.coach.stream_failed", { userId, error: err });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.close();
      }
    },
  });
}
