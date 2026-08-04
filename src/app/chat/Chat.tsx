"use client";

import { useState } from "react";
import type { UIMessage, ChatStatus } from "ai";
import { MessageBubble } from "./MessageBubble";
import { extractSources } from "./extractSources";

export function Chat({
  messages,
  status,
  userTimestamps,
  assistantTimestamps,
  onSend,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  userTimestamps: number[];
  assistantTimestamps: Record<string, number>;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    onSend(input);
    setInput("");
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-5">
      <div className="clip-corner flex flex-1 flex-col gap-6 overflow-y-auto border-2 border-[var(--border-dim)] bg-[var(--bg-panel)]/60 p-8">
        {messages.length === 0 && (
          <p className="font-mono text-base text-[var(--text-dim)]">
            <span className="text-[var(--neon-cyan)]">&gt;</span> Ask something like &ldquo;What&apos;s
            my status on the SkillLayer application?&rdquo;
          </p>
        )}

        {(() => {
          const userMessageIds = messages.filter((m) => m.role === "user").map((m) => m.id);

          return messages.map((message) => {
            const isUser = message.role === "user";
            const text = message.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("");

            return (
              <MessageBubble
                key={message.id}
                role={isUser ? "user" : "assistant"}
                text={text}
                sources={extractSources(message.parts)}
                pending={isBusy}
                timestamp={
                  isUser
                    ? userTimestamps[userMessageIds.indexOf(message.id)]
                    : assistantTimestamps[message.id]
                }
              />
            );
          });
        })()}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <span className="flex items-center font-mono text-xl text-[var(--neon-yellow)] glow-text-yellow">
          &gt;
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ask your brain..."
          disabled={isBusy}
          className="clip-corner-sm flex-1 border-2 border-[var(--border-dim)] bg-[var(--bg-panel)] px-5 py-4 text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--neon-yellow)] focus:shadow-[var(--glow-yellow)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="clip-corner-sm border-2 border-[var(--neon-pink)]/70 bg-[var(--bg-panel-raised)] px-8 py-4 font-mono text-base font-bold text-[var(--neon-pink)] transition-shadow hover:glow-border-pink disabled:opacity-40 disabled:hover:shadow-none"
        >
          SEND
        </button>
      </form>
    </div>
  );
}
