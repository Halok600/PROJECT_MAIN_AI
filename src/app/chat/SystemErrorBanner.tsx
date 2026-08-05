export function SystemErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="clip-corner-sm glow-border-pink flex max-w-[68ch] flex-col gap-3 self-start border-2 border-[var(--neon-pink)]/70 bg-[var(--bg-panel-raised)] px-6 py-4">
      <span className="font-mono text-sm font-bold leading-relaxed text-[var(--neon-pink)] glow-text-pink">
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="clip-corner-sm self-start border-2 border-[var(--neon-cyan)]/70 bg-[var(--bg-panel)] px-4 py-2 font-mono text-xs font-bold tracking-wide text-[var(--neon-cyan)] transition-shadow hover:glow-border-cyan"
      >
        ↻ RETRY
      </button>
    </div>
  );
}
