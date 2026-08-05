import { motion } from "framer-motion";

export type Source = {
  tool: "search_gmail" | "search_drive";
  title: string;
  slug: string;
  score: number;
  url?: string;
};

const ICON: Record<Source["tool"], string> = {
  search_gmail: "✉",
  search_drive: "▤",
};

const BASE_CLASSES =
  "clip-corner-sm inline-flex items-center gap-2 border-2 border-[var(--border-dim)] " +
  "bg-[var(--bg-panel-raised)] px-3 py-1.5 font-mono text-sm font-bold text-[var(--neon-cyan)] " +
  "transition-colors hover:border-[var(--neon-yellow)] hover:text-[var(--neon-yellow)] hover:glow-text-yellow";
const LINK_CLASSES = `${BASE_CLASSES} underline decoration-2 underline-offset-2`;

export function SourceChip({ source }: { source: Source }) {
  const label = source.title || source.slug;
  const content = (
    <>
      <span aria-hidden>{ICON[source.tool]}</span>
      <span className="max-w-[240px] truncate">{label}</span>
    </>
  );

  if (!source.url) {
    return (
      <span className={BASE_CLASSES} title={`relevance ${source.score.toFixed(2)}`}>
        {content}
      </span>
    );
  }

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`relevance ${source.score.toFixed(2)} — open source`}
      className={LINK_CLASSES}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      {content}
    </motion.a>
  );
}
