import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

// See JOURNAL.md 2026-08-03/04 — the brain repo is its own local git
// repository (required by gbrain sync), nested inside (and gitignored by)
// the app's own repo. Ingestion is deliberately local-only (see JOURNAL.md
// 2026-08-04 Vercel deployment entry) — search/query moved to the remote
// MCP server (gbrain-remote.ts) so it works from both local dev and Vercel,
// but committing + syncing the brain repo still requires a local git repo
// and a local gbrain binary, neither of which exist on Vercel.
const BRAIN_REPO_DIR = path.join(process.cwd(), "brain");
const GBRAIN_SOURCE_ID = "personal-brain";

/**
 * bun installs a real gbrain.exe shim on Windows (not a .cmd), so this never
 * needs `shell: true` — which is deliberate: passing shell:true to execFile
 * on Windows does NOT escape special characters in args (parens, &, |, ...),
 * so a commit message like "ingest: 50 gmail message(s)" gets its
 * parentheses interpreted as cmd.exe command-grouping syntax and silently
 * mangles the command. Invoking the real .exe/.git binaries directly with
 * execFile (no shell) passes args to CreateProcess verbatim — no escaping
 * needed. See JOURNAL.md 2026-08-04.
 */
function gbrainBin() {
  // Resolving "gbrain.exe" via PATH fails (ENOENT) if the Node process was
  // started in a shell whose PATH predates the bun/gbrain install — same
  // class of stale-env issue as the earlier setx gotcha. An absolute path
  // sidesteps PATH resolution entirely. Override via GBRAIN_BIN_PATH if
  // installed elsewhere.
  if (process.env.GBRAIN_BIN_PATH) return process.env.GBRAIN_BIN_PATH;
  if (process.platform === "win32") {
    return path.join(process.env.USERPROFILE ?? "", ".bun", "bin", "gbrain.exe");
  }
  return "gbrain";
}

async function run(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: BRAIN_REPO_DIR,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout, stderr };
}

/** Commits any pending writes in the brain repo so gbrain's git-backed sync can see them. */
export async function commitBrainRepo(message: string): Promise<{ committed: boolean; log: string }> {
  await run("git", ["add", "-A"]);

  const status = await run("git", ["status", "--porcelain"]);
  if (!status.stdout.trim()) {
    return { committed: false, log: "No changes to commit." };
  }

  const commit = await run("git", [
    "-c",
    "user.email=local@personal-brain.dev",
    "-c",
    "user.name=Personal Brain Ingestion",
    "commit",
    "-m",
    message,
  ]);
  return { committed: true, log: commit.stdout };
}

export async function syncBrain(): Promise<string> {
  const { stdout, stderr } = await run(gbrainBin(), ["sync", "--source", GBRAIN_SOURCE_ID]);
  return stdout + stderr;
}
