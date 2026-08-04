const BAR_COUNT = 5;

export function ThinkingIndicator() {
  return (
    <div className="thinking-indicator" role="status" aria-label="Personal Brain is processing">
      <div className="thinking-bars" aria-hidden>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className="thinking-bar"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <span className="thinking-label">[ PROCESSING_DATA... ]</span>
    </div>
  );
}
