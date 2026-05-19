import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCoachMessages, appendCoachMessage } from "@/lib/db/queries/coach";
import { streamCoachReply } from "@/lib/anthropic/coach";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { message } = parsed.data;

  // Persist user message before streaming
  await appendCoachMessage({ userId: user.id, role: "user", content: message });

  // Load history (excludes the message we just inserted — fetch all and trim)
  const allMessages = await getCoachMessages(user.id);
  // history = all messages except the last one (the user message just saved)
  const history = allMessages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let assistantText = "";

  try {
    const sseStream = await streamCoachReply({
      userId: user.id,
      history,
      userMessage: message,
    });

    // Collect the full text as it streams, then save on completion
    const [streamForClient, streamForSaving] = sseStream.tee();

    // Background: collect and save assistant message
    (async () => {
      const reader = streamForSaving.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Parse SSE data lines
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data) as { text?: string };
              if (parsed.text) assistantText += parsed.text;
            } catch {
              // ignore malformed
            }
          }
        }
      } finally {
        reader.releaseLock();
        if (assistantText) {
          await appendCoachMessage({
            userId: user.id,
            role: "assistant",
            content: assistantText,
          }).catch(() => {});
        }
      }
    })();

    return new Response(streamForClient, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[coach] stream error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to get response from AI coach." },
      { status: 500 },
    );
  }
}
