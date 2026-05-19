import "server-only";

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { anthropic, MODEL } from "./client";
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

  const messages: MessageParam[] = [
    ...cappedHistory,
    { role: "user", content: userMessage },
  ];

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
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
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`),
        );
        controller.close();
      }
    },
  });
}
