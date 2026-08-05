"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type SyncResult = {
  gmailCount: number;
  driveCount: number;
  pagesWritten: number;
  committed: boolean;
  syncLog: string;
};

type SyncState = "idle" | "loading" | "done" | "error";

export function SyncButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/ingest/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        type="button"
        onClick={handleSync}
        disabled={state === "loading"}
        whileHover={state === "loading" ? undefined : { scale: 1.02 }}
        whileTap={state === "loading" ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="clip-corner-sm w-full border-2 border-[var(--neon-cyan)]/70 bg-[var(--bg-panel-raised)] px-4 py-3 font-mono text-sm font-bold tracking-wide text-[var(--neon-cyan)] transition-shadow hover:glow-border-cyan disabled:opacity-40 disabled:hover:shadow-none"
      >
        {state === "loading" ? "SYNCING..." : "RE-SYNC GMAIL + DRIVE"}
      </motion.button>

      {state === "done" && result && (
        <p className="font-mono text-xs leading-snug text-[var(--text-dim)]">
          {result.gmailCount} email(s) + {result.driveCount} file(s) → {result.pagesWritten} page(s)
          {result.committed ? ", synced" : " (no changes)"}.
        </p>
      )}

      {state === "error" && (
        <p className="font-mono text-xs leading-snug text-[var(--neon-pink)]">{error}</p>
      )}
    </div>
  );
}
