# JOURNAL.md — Personal Brain build log

Format per entry: timestamp, context, decision/trade-off, prompt iteration
notes (if any), current system state.

---

## 2026-08-03 16:50 — Project kickoff, stack + spec decided

**Context:** SkillLayer SDE I take-home. Build a conversational agent over
≥2 personal data sources with cross-source reasoning, following SDD. Due
2026-08-09 00:00 (submit via reply to existing application email thread to
nirmit@skilllayer.tech, cc cristian@skilllayer.tech).

**Decision:** Stack = Next.js (App Router) + TypeScript, single deployable
app on Vercel. Connectors = Gmail + Google Drive (shared OAuth consent
screen and API client family — lowest auth overhead for a solo 6-day build,
and the assignment's own Tier 2 examples are Gmail×Drive shaped). Storage =
gbrain (https://github.com/garrytan/gbrain), interface TBD until we clone
and inspect it in Phase 1. Reasoning model = Claude via Anthropic API,
tool-use loop for retrieval routing. UI = Vercel AI SDK for streaming chat.

**Trade-off considered:** Python/FastAPI backend + separate frontend gives
more ingestion-pipeline flexibility but doubles deploy targets and plumbing
for no real benefit at this scope — rejected in favor of one Next.js app.

**Current state:** SPEC.md drafted and reviewed (v1). No code written yet.
Next: Phase 1, step 1 — scaffold Next.js project, clone/inspect gbrain,
set up Google Cloud OAuth credentials.

**Git guidance:** Repo not yet initialized. Once scaffold exists (end of
Phase 1 step 1), run:
```bash
git init
git add SPEC.md JOURNAL.md
git commit -m "Add SDD spec and journal for Personal Brain project"
```
Push commands will follow once a GitHub remote is set up (ask before
creating the remote — first time doing so this session).

---

## 2026-08-03 22:30 — Repo pushed; Next.js scaffolded; gbrain reality check

**Context:** User pushed the initial commit to
https://github.com/Halok600/PROJECT_MAIN_AI (main branch). Started Phase 1
step 1: scaffolded Next.js (App Router, TS, Tailwind, src dir) via
`create-next-app`. `npm` rejected the project name because the directory
name (`PROJECT_MAIN_AI`) has capital letters, so the app was scaffolded into
a temp subfolder and moved up into the repo root.

**Decision — gbrain integration:** Cloned gbrain
(https://github.com/garrytan/gbrain) to inspect its actual interface before
writing integration code, since SPEC.md v1 assumed it was an embeddable
storage/retrieval library. It is not: gbrain is a Bun-based CLI + MCP server,
backed by Postgres or PGLite, that treats a git repo of markdown files
("brain repo") as the system of record and syncs it into a DB for hybrid
(vector + BM25 + graph) retrieval and LLM-synthesized answers (`gbrain
search` vs `gbrain think`). It expects to run as a long-lived process/daemon,
not to be imported into a serverless function.

**Trade-off surfaced to user:** Vercel serverless functions can't host a
Bun CLI with a local PGLite file or a long-running MCP server. Three options
were laid out: (a) demo everything locally, skip Vercel; (b) deploy the
Next.js app to Vercel and run gbrain separately as `gbrain serve --http` on
an always-on host (Railway/Fly.io free tier), calling it remotely over HTTP
with a bearer token; (c) drop gbrain entirely for a lightweight SQLite+
embeddings store, documented as a deliberate SDD deviation.

**Decision:** User chose (b) — Vercel app + separately hosted gbrain server.
This is the higher-effort path but keeps us honest to the assignment's
explicit "store data in gbrain" requirement while still getting a real
Vercel deploy link. SPEC.md §3 architecture diagram updated to show the
split: Next.js/Vercel talks to gbrain over HTTP/MCP rather than importing it
in-process. Ingestion pipeline now renders normalized data as gbrain-native
markdown pages (frontmatter + body) rather than assuming a JS API.

**Risk noted:** This adds real infra work (hosting choice, token auth, two
deploy targets to keep in sync) on top of an already tight 6-day timeline.
If gbrain hosting eats too much time, fallback is to demo locally with
`gbrain serve` running alongside `next dev` and treat the Vercel deploy as
best-effort, not required — success criteria in SPEC.md §9 only requires a
"reliably local-runnable" UI at minimum.

**Current state:** Next.js app scaffolded and building at repo root. Bun
1.3.14 and gbrain 0.42.72.1 installed. Local PGLite brain initialized at
`D:\Projects\PROJECT_MAIN_AI\brain` (config/DB live in `~/.gbrain`, which is
normal for gbrain — the brain repo directory in the project is where our
ingested markdown pages will live). `/brain/` added to `.gitignore` since
it will hold real personal Gmail/Drive content once ingestion starts —
should never be pushed to the public GitHub repo.

**Embedding provider setup (Gemini):** User chose Google Gemini for
embeddings. Two gotchas hit and resolved:
1. `setx` writes to the registry but does not propagate to already-running
   shells (this agent's Bash/PowerShell tool sessions started before the
   `setx` call). Workaround: read the value out of the registry
   (`[System.Environment]::GetEnvironmentVariable(name, "User")`) inside
   each command that needs it, without ever printing the value.
2. The correct config is model `google:gemini-embedding-001` (not
   `text-embedding-004`, which doesn't exist on the embedContent endpoint)
   and env var `GOOGLE_GENERATIVE_AI_API_KEY` (not `GEMINI_API_KEY` — gbrain
   doesn't recognize that name). Also: `gbrain config set embedding_model`
   is rejected as a no-op by the CLI itself ("file-plane field that sizes
   the schema") — changing it requires wiping `~/.gbrain/brain.pglite` and
   re-running `gbrain init --pglite --embedding-model ...`, safe here only
   because the brain was still empty.

`gbrain doctor` now passes the embedding_provider check cleanly. Remaining
warnings (no embeddings yet, no skills dir, no ANTHROPIC_API_KEY for
gbrain's internal chat features) are expected/non-blocking — we're using
gbrain only for `search` (retrieval), doing synthesis and cross-source
reasoning with Claude in our own Next.js app, not gbrain's built-in `think`/
`dream`/`agent` commands.

**Next:** Google Cloud OAuth setup for Gmail + Drive scopes, then start the
ingestion pipeline (Gmail/Drive API clients → normalize → write markdown
pages into `brain/` → `gbrain sync`).
