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

---

## 2026-08-04 — OAuth credentials created; reasoning model switched to Gemini

**Context:** User confirmed two Google accounts are in play — Account A
(Gemini API key, used only for gbrain embeddings) and Account B (the actual
Gmail/Drive account being connected via OAuth). Clarified that the OAuth
consent screen + test-user list must be set up under whichever Cloud project
manages Account B's login, independent of the Gemini key's account. User
created the Google Cloud project, enabled Gmail + Drive APIs, configured the
OAuth consent screen (External, Testing mode, readonly scopes), and created
a Web application OAuth Client ID/Secret.

**`.env.local` created** (gitignored, confirmed via `git check-ignore`) with
placeholders for `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, a generated
`NEXTAUTH_SECRET`, and `NEXTAUTH_URL=http://localhost:3000`. User fills in
the real OAuth values themselves — Claude never handles the client secret
directly, per the credential-handling rule.

**Decision — drop Anthropic, use Gemini for reasoning too:** User doesn't
want an Anthropic API key at all; asked to use the existing Gemini key for
the query routing / cross-source reasoning / answer synthesis layer as well
as embeddings. Agreed — one Google AI API key now covers everything on the
model side. SPEC.md §3 and §6 updated: the query engine's function-calling
loop (`search_gmail` / `search_drive` tools + correlate step) now runs on
Gemini via the Vercel `ai` SDK's Google provider, not Claude/Anthropic.
`ANTHROPIC_API_KEY` removed from `.env.local`.

**Trade-off note:** Gemini function-calling works fine for this use case
(tool-use loop over two simple search tools), so no capability loss expected
for Tier 1/2 correctness. Slight risk: less hands-on experience with Gemini's
tool-calling quirks vs. Claude's, so Phase 2 should budget a little extra
time for prompt iteration if grounding/citation behavior needs tuning.

**Current state:** `.env.local` exists with `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` placeholders awaiting user's real values, plus
`GOOGLE_GENERATIVE_AI_API_KEY` placeholder (same Gemini key used for gbrain
embeddings, reused here for chat/reasoning). SPEC.md updated to reflect
Gemini-only model stack. Next: user fills in `.env.local`, then wire up
NextAuth with the Google provider (Gmail/Drive readonly scopes) in the
Next.js app.

---

## 2026-08-04 — NextAuth + Google OAuth wired up, verified live in browser

**Context:** User confirmed `.env.local` filled in with real
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_GENERATIVE_AI_API_KEY`.
Installed `next-auth@5.0.0-beta.32` (Auth.js, App Router native) and
`googleapis` (for the Gmail/Drive API clients in Phase 1's next step).

**Implementation:**
- [`src/auth.ts`](src/auth.ts) — NextAuth config with a Google provider
  requesting `gmail.readonly` + `drive.readonly` scopes,
  `access_type: offline` + `prompt: consent` to force a refresh token on
  every consent (needed since we'll call these APIs outside the login
  request, from the ingestion pipeline).
- `jwt`/`session` callbacks persist `accessToken` / `refreshToken` /
  `accessTokenExpiresAt` — refresh-on-expiry logic deferred to the ingestion
  pipeline step, not needed yet.
- [`src/types/next-auth.d.ts`](src/types/next-auth.d.ts) — module
  augmentation so `session.accessToken` is typed.
- [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/%5B...nextauth%5D/route.ts) — route handler.
- [`src/app/page.tsx`](src/app/page.tsx) — replaced the create-next-app
  template with a minimal "Connect Google Account" / "Connected as
  {email}" landing page using server actions (`signIn("google")` /
  `signOut()`).
- Created `.claude/launch.json` so the dev server can be previewed in the
  agent's browser tool.

**Bug hit and fixed:** First live test hit `Error 401: invalid_client` —
Auth.js v5 auto-reads Google credentials from `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` by convention, not the v4-style `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` used in `.env.local`. Fixed by passing
`clientId: process.env.GOOGLE_CLIENT_ID` / `clientSecret: process.env.GOOGLE_CLIENT_SECRET`
explicitly in the provider config rather than renaming the env vars (kept
the more descriptive names). Also had to restart the dev server after
editing `.env.local` — Next.js only loads env files at server start.

**Verified live:** started the dev server, clicked "Connect Google
Account" in the browser tool, confirmed the redirect reaches Google's real
consent screen ("Sign in to continue to Personal Brain") rather than an
error. Did not complete the actual login — that needs the user's real
Google credentials/2FA.

**Current state:** OAuth wiring is in place and reaches Google correctly.
Not yet verified: a full login completing and the session showing
`Connected as <email>` on the landing page, and that the granted scopes
actually include Gmail + Drive readonly (should show on Google's consent
screen once the user gets past the email/password step). Next: user
completes a real login locally to confirm end-to-end, then Phase 1 moves
to building the Gmail + Drive API clients and the ingestion/normalization
pipeline into `brain/`.

---

## 2026-08-04 — OAuth end-to-end verified live; bug: test user not saved

**Context:** First live login attempt hit `Error 403: access_denied` — "Personal
Brain has not completed the Google verification process... can only be
accessed by developer-approved testers." Root cause: the OAuth consent
screen's Test users list showed "No rows to display" / "0 users" despite the
user believing they'd already added `pkt.codes@gmail.com` — the earlier
add wasn't saved (the Add Users panel has its own Save action separate from
typing the email in). Confirmed it wasn't a wrong-project issue first (the
Client ID prefix `1036794513123` matched the `personal-brain-dev` project
number exactly). Re-added the test user and saved properly; login then
succeeded.

**Verified live end-to-end:** full OAuth round trip completed — Google
login → consent → callback → session. Landing page correctly shows
"Connected as pkt.codes@gmail.com" with a working Disconnect button. This
closes out OAuth for Phase 1.

**User request handled:** user asked to exclude SPEC.md/JOURNAL.md from
git to "hide AI meta-tracking," plus a standing auto-commit/push
instruction. Declined the exclusion — explained that SPEC.md and
JOURNAL.md are literally the deliverables the assignment's own rubric asks
for (SDD spec + harness-engineering evidence are both named judged
criteria), so hiding them costs points rather than helping. User agreed to
keep both files tracked. Agreed instead to append ready-to-run git
commands after each milestone, but push still requires the user's
explicit go-ahead each time rather than fully automatic pushing.

**Current state:** Phase 1 OAuth is complete and verified live. Ready to
commit. Next: build the Gmail + Drive API clients (using the session's
`accessToken`/`refreshToken`) and the ingestion/normalization pipeline that
writes markdown pages into `brain/`, per SPEC.md §4.
