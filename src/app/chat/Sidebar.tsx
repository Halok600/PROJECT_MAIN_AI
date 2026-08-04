import { Mail, HardDrive, Search, Radio } from "lucide-react";
import { SyncButton } from "../SyncButton";
import { disconnect } from "../actions";

const TOOL_META: Record<string, { label: string; icon: typeof Mail }> = {
  search_gmail: { label: "SEARCH_GMAIL", icon: Mail },
  search_drive: { label: "SEARCH_DRIVE", icon: HardDrive },
};

function StatusRow({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm bg-[var(--bg-panel)] px-3 py-2.5">
      <span className="flex items-center gap-2.5 font-mono text-sm font-bold tracking-wide text-[var(--text-primary)]">
        <Icon
          size={20}
          className="text-[var(--neon-cyan)]"
          style={{ filter: "drop-shadow(0 0 4px rgba(0, 240, 255, 0.85))" }}
        />
        {label}
      </span>
      <span className="flex items-center gap-2 font-mono text-xs font-bold text-[var(--neon-yellow)] glow-text-yellow">
        <span className="h-2 w-2 rounded-full bg-[var(--neon-yellow)]" aria-hidden />
        CONNECTED
      </span>
    </div>
  );
}

function ActiveTools({ tools }: { tools: string[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-sm bg-[var(--bg-panel)] px-3 py-2.5 font-mono text-sm text-[var(--text-dim)]">
        <Radio size={18} />
        {"// idle"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool) => {
        const meta = TOOL_META[tool] ?? { label: tool.toUpperCase(), icon: Search };
        const Icon = meta.icon;
        return (
          <div
            key={tool}
            className="flex items-center gap-2.5 rounded-sm bg-[var(--bg-panel)] px-3 py-2.5 font-mono text-sm font-bold text-[var(--neon-cyan)] glow-text-cyan"
          >
            <Icon size={18} style={{ filter: "drop-shadow(0 0 4px rgba(0, 240, 255, 0.85))" }} />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--neon-cyan)]" aria-hidden />
            {meta.label}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ email, activeTools }: { email: string; activeTools: string[] }) {
  return (
    <aside className="clip-corner flex h-full w-80 shrink-0 flex-col justify-between border-2 border-[var(--border-dim)] bg-[var(--bg-sidebar)] p-6">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest text-[var(--neon-cyan)] glow-text-cyan">
            PERSONAL_BRAIN
          </h1>
          <p className="mt-1.5 truncate font-mono text-xs text-[var(--text-dim)]">{email}</p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-bold tracking-widest text-[var(--text-dim)]">
            {"// SYSTEM_STATUS"}
          </h2>
          <StatusRow icon={Mail} label="GMAIL" />
          <StatusRow icon={HardDrive} label="DRIVE" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-bold tracking-widest text-[var(--text-dim)]">
            {"// ACTIVE_TOOLS"}
          </h2>
          <ActiveTools tools={activeTools} />
        </section>
      </div>

      <div className="flex flex-col gap-3">
        <SyncButton />
        <form action={disconnect}>
          <button
            type="submit"
            className="clip-corner-sm w-full border-2 border-[var(--neon-pink)]/70 bg-[var(--bg-panel-raised)] px-4 py-3 font-mono text-sm font-bold tracking-wide text-[var(--neon-pink)] transition-shadow hover:glow-border-pink"
          >
            DISCONNECT
          </button>
        </form>
      </div>
    </aside>
  );
}
