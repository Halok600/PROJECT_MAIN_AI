import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-black/[.08] bg-white p-10 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Personal Brain
        </h1>

        {session ? (
          <>
            <p className="text-zinc-600 dark:text-zinc-400">
              Connected as <span className="font-medium">{session.user?.email}</span>
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Chat interface goes here once ingestion + retrieval are wired up.
            </p>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="h-10 rounded-full border border-black/[.08] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Disconnect
              </button>
            </form>
          </>
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
