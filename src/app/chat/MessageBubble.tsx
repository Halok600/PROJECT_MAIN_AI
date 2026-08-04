import ReactMarkdown, { type Components } from "react-markdown";
import { SourceChip, type Source } from "./SourceChip";
import { ThinkingIndicator } from "./ThinkingIndicator";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-[var(--neon-cyan)] underline decoration-2 underline-offset-2 transition-colors hover:text-[var(--neon-yellow)] hover:glow-text-yellow"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-[var(--neon-pink)] glow-text-pink">{children}</strong>
  ),
  ul: ({ children }) => <ul className="my-2 list-none space-y-1.5 pl-0">{children}</ul>,
  li: ({ children }) => (
    <li className="pl-5 before:mr-2 before:-ml-5 before:text-[var(--neon-cyan)] before:content-['▸']">
      {children}
    </li>
  ),
  code: ({ children }) => (
    <code className="rounded-sm bg-[var(--bg-panel)] px-1.5 py-0.5 font-mono text-[var(--neon-yellow)]">
      {children}
    </code>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
};

type Role = "user" | "assistant";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "--:--";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  role,
  text,
  sources,
  pending,
  timestamp,
}: {
  role: Role;
  text: string;
  sources: Source[];
  pending: boolean;
  timestamp?: number;
}) {
  const isUser = role === "user";

  return (
    <div
      className={`flex max-w-[68ch] flex-col gap-1.5 ${
        isUser ? "self-end items-end" : "self-start items-start"
      }`}
    >
      <span className="font-mono text-xs font-bold tracking-wide text-[var(--text-dim)]">
        {isUser ? "YOU" : "BRAIN"} · {formatTime(timestamp)}
      </span>

      <div
        className={`clip-corner-sm border-l-4 px-6 py-4 text-base leading-relaxed ${
          isUser
            ? "border-y-2 border-r-2 border-y-[var(--border-dim)] border-r-[var(--border-dim)] border-l-[var(--neon-yellow)] bg-[var(--bg-panel-raised)]"
            : "border-y-2 border-r-2 border-y-[var(--border-dim)] border-r-[var(--border-dim)] border-l-[var(--neon-cyan)] bg-[var(--bg-panel)]"
        }`}
      >
        {text ? (
          <div>
            <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
          </div>
        ) : pending ? (
          <ThinkingIndicator />
        ) : null}

        {!isUser && sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-[var(--border-dim)] pt-3">
            {sources.map((s) => (
              <SourceChip key={s.slug} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
