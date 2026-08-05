export type BrainSearchHit = {
  slug: string;
  type: string;
  title: string;
  score: number;
  snippet: string;
  url?: string;
  date?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

/**
 * gbrain's HTTP MCP transport returns a single SSE "message" event per
 * JSON-RPC call rather than a plain JSON body, so the "data:" line has to be
 * pulled out before treating it as JSON-RPC. Discovered by probing the raw
 * endpoint directly — see JOURNAL.md 2026-08-04.
 */
async function mcpCall<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const url = requireEnv("GBRAIN_REMOTE_URL");
  const token = requireEnv("GBRAIN_REMOTE_TOKEN");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const raw = await res.text();
  const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    throw new Error(`Unexpected gbrain MCP response calling ${toolName}: ${raw.slice(0, 300)}`);
  }

  const rpc = JSON.parse(dataLine.slice(5));
  if (rpc.error) {
    throw new Error(`gbrain MCP error calling ${toolName}: ${rpc.error.message}`);
  }

  return JSON.parse(rpc.result.content[0].text) as T;
}

type RawSearchHit = {
  slug?: string;
  type?: string;
  title?: string;
  score?: number;
  chunk_text?: string;
};

/**
 * The url (and date) we cite live in each page's frontmatter, which `search`
 * never returns (only chunked body text) — fetch it per-hit via `get_page`.
 * This is what lets local dev and the Vercel deployment share one
 * implementation: neither needs local filesystem access to brain/*.md
 * anymore. `date` was added after an eval run (evals/EVAL_LOG.md,
 * JOURNAL.md 2026-08-05) surfaced that recency-based queries ("last week")
 * were structurally unanswerable — the model had no timestamp on any
 * result at all.
 */
async function getPageMeta(slug: string): Promise<{ url?: string; date?: string }> {
  try {
    const page = await mcpCall<{ frontmatter?: { url?: string; date?: string } }>("get_page", { slug });
    return { url: page.frontmatter?.url, date: page.frontmatter?.date };
  } catch (err) {
    console.error(`Failed to fetch frontmatter for ${slug}`, err);
    return {};
  }
}

/**
 * `search`'s own `type` filter doesn't exist in its tool schema at all
 * (confirmed via tools/list) — over-fetch and filter on the `type` field
 * already present in each result instead.
 */
export async function searchBrain(
  query: string,
  options: { limit?: number; type?: "email" | "source" } = {},
): Promise<BrainSearchHit[]> {
  const { limit = 10, type } = options;
  const overFetchLimit = type ? Math.max(limit * 4, 20) : limit;

  const results = await mcpCall<RawSearchHit[]>("search", { query, limit: overFetchLimit });

  const hits = results.map((r) => ({
    slug: r.slug ?? "",
    type: r.type ?? "",
    title: r.title ?? "",
    score: r.score ?? 0,
    snippet: r.chunk_text ?? "",
  }));

  const filtered = (type ? hits.filter((h) => h.type === type) : hits).slice(0, limit);

  // Each URL lookup is a separate round-trip to the remote gbrain server.
  // The model can call search_gmail/search_drive several times per turn
  // (observed: 3-4x with rephrased queries), and each call used to enrich
  // every one of its results — enough round-trips stacked up to blow past
  // Vercel's function timeout entirely. Snippets (already in the single
  // search response, no extra cost) still cover every hit for grounding;
  // only the top few most-relevant results get a clickable citation link.
  const MAX_URL_LOOKUPS = 3;
  const enriched = await Promise.all(
    filtered.map(async (hit, i) => {
      if (i >= MAX_URL_LOOKUPS) return hit;
      const meta = await getPageMeta(hit.slug);
      return { ...hit, url: meta.url, date: meta.date };
    }),
  );
  return enriched;
}

export const searchGmail = (query: string, limit = 10) => searchBrain(query, { limit, type: "email" });
export const searchDrive = (query: string, limit = 10) => searchBrain(query, { limit, type: "source" });
