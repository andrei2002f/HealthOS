"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/Markdown";
import { cn } from "@/lib/utils";
import { clearConversation } from "@/app/(app)/coach/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

type Props = {
  initialMessages: Message[];
};

export function CoachChat({ initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, startClear] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = {
              role: "assistant",
              content: "Sorry, something went wrong. Please try again.",
            };
          }
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) {
              accumulated = parsed.error;
            } else if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // ignore
          }
        }

        // Update the streaming message live
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = {
              role: "assistant",
              content: accumulated,
              streaming: true,
            };
          }
          return next;
        });
      }

      // Finalize: remove streaming flag
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = { role: "assistant", content: accumulated };
        }
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClear() {
    startClear(async () => {
      await clearConversation();
      setMessages([]);
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3">
        <h1 className="text-lg font-semibold">AI Coach</h1>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={clearing || sending}
            className="text-muted-foreground text-xs"
          >
            Clear conversation
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pb-2">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center pt-12">
            Ask me anything about your training, recovery, or health data.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "rounded-lg px-4 py-2 max-w-[85%]",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground text-sm"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.role === "assistant" ? (
                <>
                  <Markdown content={msg.content} />
                  {msg.streaming && (
                    <span className="inline-block w-2 h-4 bg-current opacity-70 animate-pulse ml-1 align-middle" />
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t pt-3 mt-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach… (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="resize-none flex-1 text-sm"
          disabled={sending}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0"
        >
          {sending ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
