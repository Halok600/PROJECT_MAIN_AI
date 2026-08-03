"use client";

import { useState } from "react";

type SyncResult = {
  gmailCount: number;
  driveCount: number;
  pagesWritten: number;
  committed: boolean;
  syncLog: string;
};

export function SyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
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
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={state === "loading"}
        className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {state === "loading" ? "Syncing…" : "Re-sync Gmail + Drive"}
      </button>

      {state === "done" && result && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Ingested {result.gmailCount} email(s) + {result.driveCount} file(s), wrote{" "}
          {result.pagesWritten} page(s){result.committed ? ", synced to brain" : " (no changes)"}.
        </p>
      )}

      {state === "error" && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
