import { motion } from "framer-motion";

export function SystemErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="clip-corner-sm glow-border-pink flex max-w-[68ch] flex-col gap-3 self-start border-2 border-[var(--neon-pink)]/70 bg-[var(--bg-panel-raised)] px-6 py-4"
    >
      <span className="font-mono text-sm font-bold leading-relaxed text-[var(--neon-pink)] glow-text-pink">
        {message}
      </span>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="clip-corner-sm self-start border-2 border-[var(--neon-cyan)]/70 bg-[var(--bg-panel)] px-4 py-2 font-mono text-xs font-bold tracking-wide text-[var(--neon-cyan)] transition-shadow hover:glow-border-cyan"
      >
        ↻ RETRY
      </motion.button>
    </motion.div>
  );
}
