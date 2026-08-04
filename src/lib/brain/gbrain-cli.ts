import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);

// See JOURNAL.md 2026-08-03/04 — the brain repo is its own local git
// repository (required by gbrain sync), nested inside (and gitignored by)
// the app's own repo.
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

export type BrainSearchHit = {
  slug: string;
  type: string;
  title: string;
  score: number;
  snippet: string;
  url?: string;
};

/**
 * gbrain's search results don't include frontmatter (only chunked body
 * text), so the real Gmail/Drive URL we wrote into each page's frontmatter
 * (see markdown.ts) has to be read back off disk directly. Best-effort:
 * a missing/unparseable file just means no link, not a failed search.
 */
async function readPageUrl(slug: string): Promise<string | undefined> {
  try {
    const raw = await readFile(path.join(BRAIN_REPO_DIR, `${slug}.md`), "utf-8");
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return undefined;

    const frontmatter = parseYaml(frontmatterMatch[1]) as { url?: string };
    return frontmatter.url;
  } catch {
    return undefined;
  }
}

/**
 * `gbrain search` (plain CLI) has no --json output; `gbrain call <tool> <json>`
 * invokes gbrain's MCP tool surface directly and returns structured JSON.
 * See JOURNAL.md 2026-08-04 for how this was discovered.
 *
 * `type` filters client-side: the search tool's own `type` param is silently
 * ignored server-side (verified empirically — a type:"email" call still
 * returned "source" pages), so we over-fetch and filter on the `type` field
 * already present in each result instead of trusting the param.
 */
export async function searchBrain(
  query: string,
  options: { limit?: number; type?: "email" | "source" } = {},
): Promise<BrainSearchHit[]> {
  const { limit = 10, type } = options;
  const overFetchLimit = type ? Math.max(limit * 4, 20) : limit;

  const args = JSON.stringify({ query, source: GBRAIN_SOURCE_ID, limit: overFetchLimit });
  const { stdout } = await run(gbrainBin(), ["call", "search", args]);

  try {
    const results: Array<{
      slug?: string;
      type?: string;
      title?: string;
      score?: number;
      chunk_text?: string;
    }> = JSON.parse(stdout);

    const hits = results.map((r) => ({
      slug: r.slug ?? "",
      type: r.type ?? "",
      title: r.title ?? "",
      score: r.score ?? 0,
      snippet: r.chunk_text ?? "",
    }));

    const filtered = (type ? hits.filter((h) => h.type === type) : hits).slice(0, limit);

    const withUrls = await Promise.all(
      filtered.map(async (hit) => ({ ...hit, url: await readPageUrl(hit.slug) })),
    );
    return withUrls;
  } catch (err) {
    console.error("Failed to parse gbrain call search output", err, stdout);
    return [];
  }
}

export const searchGmail = (query: string, limit = 10) => searchBrain(query, { limit, type: "email" });
export const searchDrive = (query: string, limit = 10) => searchBrain(query, { limit, type: "source" });
