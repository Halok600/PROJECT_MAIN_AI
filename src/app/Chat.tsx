"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

type Source = { tool: "search_gmail" | "search_drive"; title: string; slug: string; score: number };

const RELEVANCE_THRESHOLD = 0.5;
const MAX_SOURCES_SHOWN = 6;

/**
 * The model often calls the same tool multiple times with overlapping/rephrased
 * queries in one turn, so raw results can contain the same page repeatedly
 * (which also breaks React's key uniqueness) and a long tail of low-relevance
 * matches. Dedupe by slug (keep the best score seen), drop anything below a
 * relevance floor, and cap the count so the footnote stays a quick citation
 * list rather than a dump of every result the model glanced at.
 */
function extractSources(parts: ReadonlyArray<{ type: string; state?: string; output?: unknown }>): Source[] {
  const bySlug = new Map<string, Source>();

  for (const part of parts) {
    if (part.type !== "tool-search_gmail" && part.type !== "tool-search_drive") continue;
    if (part.state !== "output-available") continue;

    const tool = part.type === "tool-search_gmail" ? "search_gmail" : "search_drive";
    const output = part.output as { results?: { title: string; slug: string; score: number }[] } | undefined;

    for (const r of output?.results ?? []) {
      if (r.score < RELEVANCE_THRESHOLD) continue;
      const existing = bySlug.get(r.slug);
      if (!existing || r.score > existing.score) {
        bySlug.set(r.slug, { tool, title: r.title, slug: r.slug, score: r.score });
      }
    }
  }

  return Array.from(bySlug.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES_SHOWN);
}

function SourcesFootnote({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/[.06] pt-2 dark:border-white/[.08]">
      {sources.map((s) => (
        <span
          key={`${s.tool}-${s.slug}`}
          title={`score ${s.score.toFixed(2)}`}
          className="rounded-full bg-black/[.04] px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.06] dark:text-zinc-400"
        >
          {s.tool === "search_gmail" ? "✉️" : "📄"} {s.title || s.slug}
        </span>
      ))}
    </div>
  );
}

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      <div className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.1] dark:bg-black/40">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Ask something like &ldquo;What&apos;s my status on the SkillLayer application?&rdquo;
          </p>
        )}

        {messages.map((message) => {
          const text = message.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const sources = extractSources(message.parts);

          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "self-end bg-foreground text-background"
                  : "self-start bg-white text-black dark:bg-zinc-900 dark:text-zinc-50"
              }`}
            >
              <p className="whitespace-pre-wrap">{text || (isBusy ? "…" : "")}</p>
              {message.role === "assistant" && <SourcesFootnote sources={sources} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your brain…"
          disabled={isBusy}
          className="flex-1 rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm outline-none focus:border-black/[.2] disabled:opacity-50 dark:border-white/[.15] dark:bg-zinc-950 dark:focus:border-white/[.3]"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Send
        </button>
      </form>
    </div>
  );
}
