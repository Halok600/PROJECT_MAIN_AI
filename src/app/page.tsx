import { auth, signIn } from "@/auth";
import { Workspace } from "./chat/Workspace";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LoginScreen />;
  }

  return <Workspace email={session.user?.email ?? "unknown"} />;
}

function LoginScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)]">
      <main className="clip-corner glow-border-cyan flex w-full max-w-lg flex-col items-center gap-8 border-2 border-[var(--border-dim)] bg-[var(--bg-panel)] p-14 text-center">
        <h1 className="font-mono text-4xl font-bold tracking-widest text-[var(--neon-cyan)] glow-text-cyan">
          PERSONAL_BRAIN
        </h1>
        <p className="text-lg text-[var(--text-dim)]">
          Connect your Google account to let the brain read your Gmail and Drive
          (read-only).
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="clip-corner-sm border-2 border-[var(--neon-pink)]/70 bg-[var(--bg-panel-raised)] px-8 py-4 font-mono text-base font-bold tracking-wide text-[var(--neon-pink)] transition-shadow hover:glow-border-pink"
          >
            CONNECT GOOGLE ACCOUNT
          </button>
        </form>
      </main>
    </div>
  );
}
