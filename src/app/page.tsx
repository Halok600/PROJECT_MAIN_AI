import { auth, signIn, signOut } from "@/auth";
import { SyncButton } from "./SyncButton";
import { Chat } from "./Chat";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-black/[.08] bg-white p-10 text-center dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Personal Brain
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Connect your Google account to let the brain read your Gmail and
            Drive (read-only).
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Connect Google Account
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
              Personal Brain
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Connected as {session.user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncButton />
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="h-9 rounded-full border border-black/[.08] px-4 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Disconnect
              </button>
            </form>
          </div>
        </header>

        <Chat />
      </main>
    </div>
  );
}
