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

---

## 2026-08-04 — Gmail + Drive API clients built and verified against real data

**Implementation:**
- [`src/auth.ts`](src/auth.ts) — added automatic access-token refresh in the
  `jwt` callback (Google access tokens expire in ~1hr; ingestion needs to
  keep working past that). Refreshes ~60s before expiry using the stored
  refresh token via a direct POST to Google's token endpoint (no extra
  dependency needed). Surfaces `MissingRefreshToken` /
  `RefreshAccessTokenError` on `session.error` so callers can detect a dead
  session instead of silently failing.
- [`src/lib/google/gmail.ts`](src/lib/google/gmail.ts) — `searchMessages` /
  `listRecentMessages`. Parses Gmail's MIME payload tree, prefers
  `text/plain`, falls back to `text/html` stripped to text. Extracts
  subject/from/to/cc/date/snippet/attachments (filename + attachmentId, not
  content — attachment bytes fetched on demand later if a query needs them).
- [`src/lib/google/drive.ts`](src/lib/google/drive.ts) — `searchFiles` /
  `listRecentFiles`. Exports Google Docs as plain text via the Drive export
  endpoint; reads `text/*` and JSON files directly; binary formats (PDF,
  Sheets, Slides, images) are skipped for now — out of scope per SPEC.md,
  metadata (name/owner/dates) still indexed.
- Test routes `/api/ingest/gmail` and `/api/ingest/drive` (session-gated)
  to verify against real data before building the full normalizer.

**Bug hit and fixed:** first live Gmail test returned readable JSON but
HTML-only email bodies were full of raw CSS (`.container { width: 100%
!important; ... }`) and HTML entities (`&#8199;`) — the naive
strip-tags-with-regex fallback didn't remove `<style>`/`<script>` blocks or
decode entities. Added `htmlToText()`: strips style/script/comment blocks
before stripping remaining tags, then decodes named + numeric HTML
entities. Re-verified live — bodies now read as clean plain text. This
mattered enough to fix immediately rather than deferring, since gbrain's
retrieval/synthesis quality depends directly on ingested text being clean.

**Verified live (real data, both fixes confirmed by the user):**
- Gmail: real inbox messages (shortlisted-candidate email, internship spam,
  etc.) returned with clean subject/from/to/date/body text matching the
  actual Gmail UI.
- Drive: real files returned including the user's own SkillLayer take-home
  assignment Google Doc (content correctly exported) and an unrelated
  internship JD doc — confirms Drive export path and content extraction
  both work end-to-end.

**Current state:** Both connector clients work against real, authenticated
data with clean text extraction. Phase 1 remaining piece: the
normalizer (raw Gmail/Drive results → `BrainDocument` → markdown page with
frontmatter) and writing those pages into `brain/`, then `gbrain sync` to
index them — this is what turns "we can fetch data" into "gbrain can
retrieve it."

---

## 2026-08-04 — Ingestion/normalization pipeline built and verified live end-to-end

**Implementation:**
- [`src/lib/brain/types.ts`](src/lib/brain/types.ts) — `BrainDocument`, matching SPEC.md §4.
- [`src/lib/brain/normalize.ts`](src/lib/brain/normalize.ts) — `gmailMessageToBrainDocument`
  / `driveFileToBrainDocument`. Extracts bare email addresses from `From`/`To`/`Cc`
  headers and Drive owner fields into a unified `participants` list — this is
  the field Tier 2 cross-source joins will match on.
- [`src/lib/brain/markdown.ts`](src/lib/brain/markdown.ts) — renders a
  `BrainDocument` to gbrain's native page format (YAML frontmatter + body).
  Mapped `gmail` → gbrain's built-in `email` type (`emails/` prefix) and
  `drive` → gbrain's `source` type (`sources/` prefix) — gbrain's
  `gbrain-base-v2` schema pack (confirmed by reading
  `src/core/schema-pack/base/gbrain-base-v2.yaml` in the cloned repo) has no
  dedicated "drive file" type, and `source` (generic document/citation,
  extractable) is the closest semantic fit. Used the `yaml` package for
  frontmatter serialization rather than hand-rolling it — subjects/titles
  routinely contain colons, quotes, parens that break naive YAML.
- [`src/lib/brain/write.ts`](src/lib/brain/write.ts) — writes pages into
  `brain/<type-dir>/<slugified-id>.md`.
- [`src/lib/brain/gbrain-cli.ts`](src/lib/brain/gbrain-cli.ts) — shells out
  to `git` (commit pending brain-repo changes) and `gbrain` (sync + search).
- `POST /api/ingest/sync` ties it together: fetch Gmail + Drive → normalize
  → write pages → commit → `gbrain sync`.
- Added a real "Re-sync Gmail + Drive" button to the landing page
  ([`src/app/SyncButton.tsx`](src/app/SyncButton.tsx)) — this doubles as
  the manual re-sync UI already planned in SPEC.md §7, not just a test
  harness.

**Discovery — the brain repo needs to be its own git repository.** First
`gbrain sync` attempt failed: `Source "default" has no local_path` (the
legacy default source can't be repointed — `gbrain sources remove default`
is blocked as "backs the pre-v0.17 brain"). Registered a new named source
instead (`gbrain sources add personal-brain --path .`), which then refused
with a clearer error: gbrain requires every `--path` source to be a real
git repo with committed files (it walks git objects, so untracked files are
invisible to it — an empty commit isn't enough either). `git init`'d
`brain/` as its own **local-only** git repo, nested inside (and gitignored
by) the app's repo — never pushed anywhere, purely to satisfy gbrain's
sync mechanism. Also had to run `gbrain sources federate personal-brain` so
default cross-source search picks it up without needing `--source` on
every call.

**Discovery — `gbrain search` has no `--json`; use `gbrain call <tool> <json>`
instead.** The plain-text `search` command only prints `[score] slug --
snippet`. `gbrain call search '{"query":...,"source":...,"limit":...}'`
invokes gbrain's MCP tool surface directly and returns full structured JSON
(slug, type, title, score, chunk_text, evidence, etc.) — much better for
programmatic use. Discovered by testing against a throwaway page before
wiring real ingestion on top of it.

**Bug hit and fixed — Windows `shell: true` silently corrupts args with
special characters.** First live sync from the UI failed: `git: 'Brain' is
not a git command`. Root cause: `execFile` was called with `shell: true`
on Windows to let a `.cmd` shim resolve, but Node's shell mode does NOT
escape special characters in array args — a commit message like `"ingest:
50 gmail message(s), 48 drive file(s)"` has parentheses, which cmd.exe
interprets as command-grouping syntax, silently splitting the "command"
into multiple statements. Fixed by dropping `shell: true` entirely: bun
installs a real `gbrain.exe` (not a `.cmd`) on Windows, and `git` is a real
`.exe` too, so neither needs a shell — `execFile` passes args to
`CreateProcess` verbatim, no escaping required or possible to get wrong.

**Bug hit and fixed — `spawn gbrain.exe ENOENT`.** After removing
`shell: true`, resolving `"gbrain.exe"` by bare name via `PATH` still
failed, because the already-running `next dev` process's inherited `PATH`
predates the bun install — the same class of stale-environment issue as
the earlier `GEMINI_API_KEY`/`setx` gotcha. Fixed by resolving an absolute
path (`%USERPROFILE%\.bun\bin\gbrain.exe`) instead of relying on `PATH`,
with a `GBRAIN_BIN_PATH` env override for other machines/deploy targets.

**Verified live end-to-end (real data):** ingested 50 Gmail messages + 48
Drive files → wrote 98 markdown pages → committed to the local brain repo
→ `gbrain sync` imported + embedded them (93 pages after de-dup/filtering)
→ confirmed via `gbrain sources status` (100% embedded, 0 fails) and a
real `gbrain call search` query for "SkillLayer take home assignment",
which correctly surfaced: the actual assignment Google Doc (score 0.93),
the forwarded "Take Home Assignment" email pointing at that doc (score
0.91), and the "Shortlisted Students" email with the assignment link
(score 0.42) — top 3 results are exactly the cross-source cluster a Tier 2
query would need to correlate. Good early signal for Phase 2.

**Current state:** Phase 1 (backend: OAuth, connectors, ingestion,
gbrain-backed storage) is functionally complete and verified against real
data. Ready to commit. Next: Phase 2 — retrieval + Gemini function-calling
router for Tier 1/Tier 2 queries, per SPEC.md §6.

---

## 2026-08-04 — Phase 2: query engine built, all 3 example queries verified live

**Implementation:**
- Installed `ai` (v7.0.48), `@ai-sdk/google` (v4.0.31), `zod`.
- [`src/lib/brain/gbrain-cli.ts`](src/lib/brain/gbrain-cli.ts) —
  `searchBrain` now takes an options object with an optional `type` filter,
  plus `searchGmail`/`searchDrive` convenience wrappers. **Discovery:**
  `gbrain call search`'s own `type` parameter is silently ignored
  server-side — a `type: "email"` call still returned `source`-typed pages
  mixed in. Worked around by over-fetching (4x the requested limit, min 20)
  and filtering client-side on the `type` field already present in each
  result, then truncating to the requested limit.
- [`src/lib/query/tools.ts`](src/lib/query/tools.ts) — `search_gmail` /
  `search_drive` as AI SDK `tool()` definitions wrapping the above, per
  SPEC.md §6's two-tool router design.
- [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) — `streamText`
  with Gemini, both tools, `stopWhen: stepCountIs(5)` (multi-step tool
  loop), and a system prompt encoding the grounding rule (answer only from
  tool results; say "couldn't find it" rather than guess; call both tools
  when a question could plausibly span sources; cite which
  email/file an answer came from).

**Bug hit and fixed — `gemini-2.5-flash` is blocked for this API key.**
First live test failed: `This model models/gemini-2.5-flash is no longer
available to new users` (HTTP 404), despite the model still being listed
by the `ListModels` endpoint for this key — Google restricts some model
IDs to previously-grandfathered accounts. Queried `ListModels` directly to
see what this key can actually call, and switched to `gemini-flash-latest`
(an alias Google keeps pointed at their current recommended flash model,
so it shouldn't need revisiting as models rotate).

**Verified live against real data (bypassing the HTTP/auth layer via a
throwaway Node script calling `generateText` directly with the same tools
— only the user's own browser session is authenticated, so this was the
fastest way to test the reasoning loop before Phase 3's UI exists):**
- **Tier 1** ("find the email about being shortlisted") — correctly
  retrieved both relevant emails via `search_gmail`, and proactively also
  called `search_drive` and connected them to the linked assignment doc.
- **Tier 2** ("what's my status on the SkillLayer application, and do I
  have the take-home doc in Drive") — called both tools and produced a
  single synthesized answer correctly combining Gmail (shortlist status,
  round structure) with Drive (the actual assignment doc, deadline)  — this
  is the exact cross-source correlation shape the assignment names as "the
  actual point of the assignment."
- **Grounding / no-hallucination** ("did I send Priya a contract draft") —
  tried 7 different tool calls across both sources with varied phrasings,
  found nothing, and correctly answered "I couldn't find it" instead of
  fabricating an answer. This is the assignment's explicitly named judged
  criterion ("wrong or 'I don't know' beats confident hallucination").

**Current state:** The reasoning engine works end-to-end against real
data for all three example queries in the assignment brief. Not yet built:
the chat UI itself (Phase 3) — right now `/api/chat` exists and works, but
there's no frontend calling it yet (the landing page still only has the
re-sync button). Next: Phase 3, wire a chat UI to `/api/chat` using the AI
SDK's `useChat` hook.

---

## 2026-08-04 — Phase 3: chat UI built; hit and fixed 3 real bugs live

**Implementation:**
- Installed `@ai-sdk/react` (separate package from `ai` in this SDK
  version — `useChat` isn't exported from `ai` itself).
- [`src/app/Chat.tsx`](src/app/Chat.tsx) — client component: message list,
  streaming assistant text, input box, and a sources footnote per message
  built from the `tool-search_gmail`/`tool-search_drive` UI message parts
  (`state === "output-available"`).
- [`src/app/page.tsx`](src/app/page.tsx) — restructured the authenticated
  view into a proper app shell (header with email/re-sync/disconnect, full
  chat below) instead of the small centered auth card, which only made
  sense for the pre-chat state.

**Bug 1 (real, user-facing) — duplicate React keys crashed the page.**
First live test: the assistant response was invisible, only sources chips
showed, then the page crashed. Console: "Encountered two children with the
same key `search_gmail-emails/gmail-...`". Root cause: the model often
calls the same search tool multiple times per turn with overlapping
results, so naively flattening every tool-result across every part
produces duplicate slugs — which also meant the crash was hiding a
perfectly good answer underneath the Next.js dev error overlay. Fixed
`extractSources` in Chat.tsx to dedupe by slug (keeping the best score),
drop anything below a 0.5 relevance floor, sort by score, and cap at 6 —
this also fixed a second real UX problem (a wall of irrelevant promotional
emails in the footnote from broad low-relevance tool calls).

**Bug 2 (real, would have blocked the live demo) — the model alias
resolves to a model with a 20-request/DAY free quota.** Re-running the
exact same query that worked earlier in a plain script now failed via the
chat UI with no visible error (just "couldn't find it"), and a direct
repro hit `429 RESOURCE_EXHAUSTED`: `gemini-flash-latest` currently
resolves to `gemini-3.6-flash`, whose free tier is capped at **20
requests/day** — one multi-step tool-calling chat turn can burn 3-6 of
those alone. Probed several other model IDs directly against the
`generateContent` endpoint to find one with real headroom on this key:
`gemini-2.0-flash` came back `limit: 0` (this key has zero free quota for
it, not just exhausted), `gemini-2.5-flash-lite` is blocked entirely for
new users (404), `gemini-2.0-flash-lite` also 429'd immediately.
`gemini-flash-lite-latest` was the one model that actually worked.
Switched `/api/chat` to it and documented why in a code comment so a
future model swap doesn't reintroduce this blindly.

**Bug 3 (real, correctness-affecting) — the model correctly refused to
confirm a match it couldn't literally verify, because we withheld the
evidence.** With the lite model, "what's my status on the SkillLayer
application" reproducibly answered "couldn't find any information" *despite*
`search_gmail` returning the exact right emails at 0.86 top score. Root
cause: our `search_gmail`/`search_drive` tool output only returns
title/score/body-snippet — never the `participants` frontmatter field. The
"SHORTLISTED STUDENTS" email's body never restates "SkillLayer" (it just
says "shortlisted for the MC Round"); that context only exists as the
sender's domain (`nirmit@skillayer.tech`) in frontmatter, which gbrain
chunks from body text only — frontmatter never reaches search results or
the model. The lite model, correctly per our own grounding instructions,
declined to assert a connection it had no textual evidence for. Fixed at
the source rather than papering over it in the prompt: added a metadata
header (title + participants + attachments) into the actual page BODY in
[`markdown.ts`](src/lib/brain/markdown.ts), so this information is both
indexed for search and visible to the model in results. Required a full
re-ingestion (all 98 pages rewritten with the new body format) — the
existing pipeline handled this cleanly since writes are idempotent by id
and gbrain's sync only re-embeds changed content.

**Verified live end-to-end after both fixes, via the real chat UI (not the
bypass script) with the user's own session:** "What's my status on the
SkillLayer application, and do I have the take-home assignment document in
my Drive?" now correctly synthesizes shortlist status (from 2 emails) +
the actual Drive document (title, contents, deadline) into one coherent
answer, with a clean 3-item sources footnote (2 emails + 1 Drive doc, no
duplicates, no irrelevant junk). Also re-verified via script:
Tier 1 (Stripe failed-payment email — correctly "not found", no such email
exists) and the Priya-contract grounding case (correctly "not found") both
still hold with the new model + pipeline.

**Current state:** All three phases are functionally complete and verified
against real, live data through the actual UI: OAuth, ingestion, gbrain
storage, Gemini-based retrieval + reasoning, and a working chat frontend
with source citations. Remaining before submission: a final end-to-end
pass through the assignment's own example queries in the live UI, then
recording the demo video and preparing the submission per SPEC.md §9's
definition-of-done checklist.

---

## 2026-08-04 — Final verification pass: all definition-of-done criteria met

**Context:** Ran a structured final pass through the live chat UI (not the
bypass script) against 4 queries spanning both tiers, per SPEC.md §9.
User ran each query in their own authenticated browser session and shared
results.

**Results:**
1. **Tier 1, Gmail** — "Summarize my most recent email thread with Nirmit
   from SkillLayer" → correct summary of the shortlist notification and
   take-home assignment forward, 3 cited sources, conversational
   formatting (not a raw dump).
2. **Tier 1, Drive** — "What Drive files do I have related to
   internships?" → correctly listed both real internship JDs
   (GoMarble Growth Intern, Revrag Full Stack Developer Intern) with
   accurate one-line descriptions.
3. **Tier 2** — "What's the status of my GoMarble internship application,
   and do I have the JD saved in Drive?" → correctly reported no Gmail
   correspondence exists for this one (honest partial answer) while
   confirming the real Drive JD with accurate content — a clean
   demonstration of "wrong or 'I don't know' beats confident
   hallucination" since it didn't invent an application-status email that
   doesn't exist.
4. **Tier 2, repeat** — SkillLayer application status + take-home doc,
   re-run on a fresh page load → same correct, stable result as the
   earlier session (confirms Bug 3's fix wasn't a fluke).

All four SPEC.md §9 checkboxes now pass. Marked them `[x]` with brief
verification notes inline.

**Current state:** All three phases complete and verified live end-to-end.
Remaining before the 2026-08-09 00:00 deadline: optional Vercel deployment
of the Next.js app (gbrain itself stays local per the architecture
decision — see 2026-08-03 entry), recording the demo video, and sending
the submission email to nirmit@skilllayer.tech (cc cristian@skilllayer.tech)
replying to the original application thread.

---

## 2026-08-04 — Cyberpunk UI overhaul (two passes) + real markdown/link fixes

**Context:** After the working chat UI was verified, user requested a full
visual redesign: cyberpunk/Night City terminal aesthetic, clickable source
hyperlinks, and a code cleanup pass. Delivered in two rounds — the second
in response to feedback that the first pass was too visually minimal.

**Real bugs fixed alongside the reskin (not just styling):**
1. **`**bold**` rendered as literal asterisks.** The original Chat.tsx just
   dumped raw assistant text with `whitespace-pre-wrap` — never parsed
   markdown at all, so the model's own `**Status:**` / bullet-list output
   showed asterisks literally. Fixed by adding `react-markdown` with custom
   component overrides (bold, links, lists, code) instead of raw text.
2. **Source citations had no real links.** `search_gmail`/`search_drive`
   tool output only ever returned title/score/snippet — never the actual
   Gmail thread / Drive `webViewLink` stored in each page's frontmatter.
   gbrain's search results don't carry frontmatter (chunked body text
   only), so fixed at the source: `searchBrain()` in `gbrain-cli.ts` now
   reads each hit's `brain/<slug>.md` file directly off disk after search
   returns, parses the YAML frontmatter, and attaches the real `url`. The
   system prompt now instructs the model to cite using markdown link
   syntax when a url is present, so citations in the answer text AND the
   sources footnote are both genuinely clickable, opening the real
   Gmail/Drive item.

**Round 1 — base cyberpunk theme:**
- Fixed neon color system (cyan/pink/yellow) as CSS custom properties,
  glow utilities (multi-layer text/box-shadow), Share Tech Mono terminal
  font, subtle static scanline/grid background (deliberately static, not
  animated — flashing/scrolling backgrounds are an accessibility hazard).
- Split the monolithic Chat.tsx into modular pieces:
  `src/app/chat/{Chat,MessageBubble,SourceChip,extractSources}` — matches
  the "clean modular structure" ask.

**Round 2 — user feedback "too small/minimal, want it chunkier + icons":**
Notably, the user's feedback screenshot showed a UI with Notion/Calendar
connectors, a "Query History" panel, and a route (`/personal-brain-ui`)
that don't exist anywhere in this codebase — evidently a separate
reference mockup, not actual output of this app. Flagged this to the user
and deliberately did NOT add fake Notion/Calendar connector chrome, since
we don't have those integrations — showing a "Disconnected" badge for a
service we never built would misrepresent the system's real capabilities
during the graded demo. Implemented the explicit, real requests instead:
- Scaled up base font size (18px root), all padding/buttons/input chunkier.
- Locked the palette to the user's exact specified hex values (`#0a0a0c`
  bg, `#00f0ff` cyan, `#fcee0a` yellow, `#ff003c` pink) with much stronger
  3-layer glow shadows.
- Added `lucide-react` icons (Mail for Gmail, HardDrive for Drive) with
  neon drop-shadow tint, replacing plain text status labels.
- Deeper `clip-path` cut corners on all panels/buttons/chips.
- Source links: cyan by default, glow yellow on hover, per spec.

**Also restructured the layout during round 2** (full-viewport sidebar +
chat split, replacing the earlier centered-box layout) — `Sidebar.tsx`
(connection status, live pulsing "active tool" indicators sourced from the
in-flight tool-call parts of the last message, sync/disconnect) +
`Workspace.tsx` (top-level client shell owning `useChat` state) +
`Chat.tsx` (message list + input, now a pure props-driven presentational
component). `src/app/actions.ts` added as a standalone `"use server"`
module for the disconnect action, so the client-side `Workspace` tree can
import a server action directly without prop-drilling it down from a
server component.

**Lint caught 3 genuine React correctness bugs during round 2's
refactor** (this project's eslint config includes the newer React
Compiler-aligned purity rules): calling `Date.now()` inside a JSX prop
expression during render (impure), writing to a `ref.current` during
render to shadow state for an effect closure (also impure — effects
should read fresh state via the functional `setState` updater instead),
and calling `setState` directly inside a bare `useEffect` body (flagged
as an unnecessary cascading-render pattern). Fixed by moving all
`Date.now()` timestamp-stamping into genuine event callbacks instead of
render/effects: `onFinish` on `useChat` (fires once per completed
assistant response) stamps the assistant message, and the chat submit
handler stamps the user message immediately using a client-generated
`messageId` passed through to `sendMessage`.

**Verified:** `tsc --noEmit`, `eslint src`, and `next build` all clean
after every round; no console errors in a live page load. Full manual
click-through (login screen, sidebar, live chat with tool activity and
clickable sources) still pending user confirmation in their own browser.

**Current state:** UI overhaul complete pending the user's final visual
sign-off. All backend/reasoning functionality from the earlier verified
pass is untouched — this was a frontend-only change.

---

## 2026-08-04 — Bug: sending a message crashed with "message with id ... not found"

**Context:** User tried the new UI live and hit a Next.js runtime error
overlay immediately on send: `message with id <uuid> not found`.

**Root cause:** Misread `useChat().sendMessage`'s `messageId` option. Its
actual contract (confirmed from `node_modules/ai/dist/index.d.ts`'s doc
comment: "If a messageId is provided, the message will be replaced.") is
to **replace an existing message**, not to assign an id to a brand-new
one. The earlier timestamp-tracking implementation generated a fresh
`crypto.randomUUID()` and passed it as `messageId` hoping to pre-assign
the new user message's id — instead the SDK tried to find-and-replace a
message with that id, found none, and threw.

**Fix:** Dropped the fabricated-id approach entirely. User message
timestamps are now tracked by **send order**, not id: `Workspace.tsx`
keeps a plain `number[]` (`userTimestamps`), appending `Date.now()` in the
submit handler (a real event callback) before calling
`chat.sendMessage({ text })` with no `messageId`. `Chat.tsx` matches each
rendered user message to its timestamp by computing
`userMessageIds.indexOf(message.id)` against the list of user message ids
in the current `messages` array — no fabricated id needed anywhere.
Assistant timestamps are unaffected (they already used the real id
supplied by `onFinish`, which was never the problem).

**Lint caught another purity violation while fixing this:** an IIFE
computing render output used a mutable `let userIndex = -1` counter
incremented while mapping — flagged as "cannot reassign variable after
render completes" by the same React Compiler-aligned purity rules from
the earlier refactor. Rewrote without any mutable state: build an
immutable `userMessageIds` array first via `.filter().map()`, then look
up each user message's position with `.indexOf()` — O(n²) for a chat
transcript that's realistically dozens of messages, not worth optimizing.

**Verified:** `tsc --noEmit`, `eslint src`, `next build` all clean.
Live click-through re-requested from the user.

---

## 2026-08-04 — Vercel deployment prep: migrated gbrain to Supabase + remote MCP

**Context:** User asked to deploy to Vercel, with an explicit ask to keep
API keys out of the public repo. Flagged upfront that the current
implementation can't run on Vercel as-is: `/api/chat` and
`/api/ingest/sync` shell out to a locally-installed Windows `gbrain.exe`
binary and read/write a local git repo (`brain/`) — none of which exist on
Vercel's stateless Linux serverless functions. Presented three options
(skip Vercel / build real remote-gbrain hosting / UI-only broken-demo
shell); user chose to build it properly.

**Scope decision:** Ingestion stays local-only (already fully built,
inherently about reading the user's private Gmail/Drive — arguably
shouldn't be triggerable from a public URL anyway). What moves remote is
the shared data store and the query/search path, so both local dev and the
eventual Vercel deployment read the same brain.

**Step 1 — Supabase.** User created a Supabase project, enabled the
`vector` extension (required — gbrain's schema migrations refuse to run
without it), and got both the Transaction pooler (port 6543, main
read/write) and Session pooler (port 5432, IPv4 workaround for
DDL/migrations/locks) connection strings per gbrain's own documented
gotchas (`docs/tutorials/personal-brain.md` §7a-7c in the cloned repo).

**Step 2 — migrated local gbrain from PGLite to Postgres.**
- `gbrain config set database_url "<transaction pooler>"` — first attempt
  appeared to silently fail (`gbrain config show` didn't list it
  afterward), but a second attempt printed explicit confirmation
  (`Set database_url = postgresql://...`); turned out `config show`
  deliberately omits `database_url` from its display rather than the value
  never having saved.
- `setx GBRAIN_DIRECT_DATABASE_URL "<session pooler>"` — the IPv4 fix.
- `gbrain migrate --to supabase` initially failed ("no connection string
  provided") despite `database_url` being configured — the migrate command
  doesn't read it from config automatically and needs `--url` passed
  explicitly. Retrieved the already-configured value via
  `gbrain config get database_url` (never displayed in chat) and passed it
  as `--url`.
- Migration succeeded: all 98 pages + links + embeddings copied, verified
  matching count and 100% embedding coverage. `config.json` now shows
  `"engine": "postgres"`. Local dev's search/chat continues working
  unchanged against the new backend — gbrain's own config file abstracts
  the engine switch away from our app code entirely.

**Step 3 — hosting `gbrain serve --http` and the auth gotcha that cost the
most time.** Created a legacy bearer token via `gbrain auth create
"test-client"` (simpler than the full OAuth 2.1 client_credentials flow
for a server-to-server use case, and Postgres-only — which we now have).
First few `tools/call` requests against the local HTTP server (tested
before touching Railway, to de-risk the remote deploy) all returned empty
results (`"[]"`) despite the exact same query working via local CLI
against the same Supabase database. Root cause, found by reading
`src/core/oauth-provider.ts` in the cloned repo: **legacy bearer tokens
default to the `default` source (0 pages) unless a `permissions.source_id`
grant is explicitly set** — no CLI flag exists for this on `gbrain auth
create` (only `register-client`, the OAuth path, has `--source`). Fixed by
UPDATE-ing the token's `permissions` JSONB directly in Supabase (via a
throwaway Node script using the `postgres` package, run once, not added as
a project dependency) to add `source_id: "personal-brain"`. Search then
worked correctly and matched local CLI results exactly.

**Also discovered while probing the raw HTTP endpoint:**
- The MCP HTTP transport requires `Accept: application/json,
  text/event-stream` or it 406s.
- Responses come back as a single SSE `event: message` frame, not a plain
  JSON body — the `data:` line has to be extracted before parsing as
  JSON-RPC.
- The `search` tool's schema (confirmed via `tools/list`) has no `source`
  parameter at all — scoping is entirely by the authenticated token's
  grant, not a per-call argument.
- `search` still returns only chunked body text, no frontmatter — so the
  real Gmail/Drive `url` we cite still needs a second call per hit, now to
  the remote `get_page` tool (confirmed it returns
  `frontmatter.url`) instead of reading a local file. This is what makes
  the same code path work identically from Vercel, which has no
  filesystem access to `brain/*.md` at all.

**Code changes:**
- [`src/lib/brain/gbrain-remote.ts`](src/lib/brain/gbrain-remote.ts) (new)
  — the unified MCP HTTP client (`mcpCall`, `searchBrain`, `searchGmail`,
  `searchDrive`, `get_page`-based URL lookup). Used by BOTH local dev and
  the eventual Vercel deployment — no more dual code paths.
- [`src/lib/query/tools.ts`](src/lib/query/tools.ts) — now imports search
  from `gbrain-remote` instead of `gbrain-cli`.
- [`src/lib/brain/gbrain-cli.ts`](src/lib/brain/gbrain-cli.ts) — trimmed
  to only `commitBrainRepo` / `syncBrain` (ingestion, still local-only by
  design). All search-related code removed.
- `.env.local` gained `GBRAIN_REMOTE_URL` (currently
  `http://localhost:3131/mcp` for local testing) and `GBRAIN_REMOTE_TOKEN`
  (written directly to the file, never displayed in chat, same pattern as
  `NEXTAUTH_SECRET`).

**Verified:** `tsc --noEmit`, `eslint src` both clean. Raw curl tests
against the local `gbrain serve --http` (pointed at Supabase) confirm
`search` and `get_page` both return correct, real data matching local CLI
results exactly.

**Current state:** Local gbrain fully migrated to Supabase; local HTTP MCP
server validated end-to-end at the protocol level. Not yet done: full
chat-UI click-through against the new remote-search code path (should be
transparent to the user, but not yet confirmed), then deploying `gbrain
serve --http` to Railway (currently only running on the dev machine),
then deploying the Next.js app itself to Vercel with all secrets set via
Vercel's Environment Variables dashboard.

---

## 2026-08-04 — gbrain hosted remotely on Render (not Railway); fixed embedding-dimension crash

**Context:** Before deploying, user asked how to make hosting last "at
least a year or two" without ongoing cost — flagged that Railway's free
tier is a one-time trial credit (~$5), not perpetual, so it wouldn't meet
that goal even though it's the easiest setup. Laid out three real options
(Render free tier / Railway now + migrate later / Oracle Cloud Always
Free) with honest trade-offs (cold-starts vs. setup effort vs. true
permanence). User chose Render — genuinely free indefinitely, similar
ease of setup to Railway, at the cost of occasional cold-start latency
after inactivity.

**Deploy setup:** Added [`gbrain-server/Dockerfile`](gbrain-server/Dockerfile)
— a minimal `oven/bun:1` image that installs gbrain globally and runs
`gbrain serve --http --port ${PORT:-3131} --bind 0.0.0.0`. Deliberately no
`config.json` baked into the image and no `--public-url` flag: engine
auto-detects to `postgres` when no config file exists and
`GBRAIN_DATABASE_URL` is set (confirmed by reading `src/core/config.ts` in
the cloned repo), and `--public-url` is only needed for OAuth 2.1 issuer
discovery, which this deployment doesn't use (legacy bearer tokens
instead). Render service created with root directory `gbrain-server`,
Docker runtime, free instance type, and env vars `GBRAIN_DATABASE_URL`
(transaction pooler), `GBRAIN_DIRECT_DATABASE_URL` (session pooler),
`GOOGLE_GENERATIVE_AI_API_KEY`.

**Bug hit and fixed — search silently 404'd on the deployed instance
(GET worked, POST didn't).** First live test against the Render URL:
`GET /mcp` correctly returned 405 (route exists, wrong method), but
`POST /mcp` with a real `tools/call` search request returned a bare
`Not Found` — even with no Authorization header at all, ruling out an
auth-scoping issue. Checked Render's server logs (user shared
screenshots) and found the actual cause spelled out in gbrain's own
startup output: *"Stateless hosts: embedding_model/embedding_dimensions
resolve from env/config.json only — set GBRAIN_EMBEDDING_MODEL /
GBRAIN_EMBEDDING_DIMENSIONS... to match the brain's schema."* Neither var
was set, so the server fell back to gbrain's default embedder
(`zeroentropyai:zembed-1`, 1280 dimensions) instead of the actual brain's
schema (`google:gemini-embedding-001`, 768 dimensions) — `search` has to
embed the query text before it can do vector search, so the dimension
mismatch crashed that code path specifically while dimension-agnostic
routes (bare GET) stayed fine. Fixed by adding `GBRAIN_EMBEDDING_MODEL=
google:gemini-embedding-001` and `GBRAIN_EMBEDDING_DIMENSIONS=768` to
Render's env vars; Render auto-redeployed and the very same search query
returned correct real results afterward (score 1.0 on the exact-match
Drive doc — even better ranked than local, interesting but not
investigated further).

**Also noted, not acted on:** startup logs also warned
`GBRAIN_HTTP_CORS_ORIGIN is unset — OAuth endpoints will reject ALL
cross-origin requests`. Not relevant here — our Next.js API routes call
gbrain server-side (Node `fetch`, not browser JS), so browser CORS policy
never applies to this traffic. Left unset.

**Cleanup:** killed the temporary local `gbrain serve --http` process
(was only running in this session's own background shell for
pre-deployment testing) and updated `.env.local`'s `GBRAIN_REMOTE_URL`
from `http://localhost:3131/mcp` to the live Render URL — local dev now
talks to the same remote brain the eventual Vercel deployment will use.

**Verified:** live `curl` against `https://personal-brain-gbrain.onrender.com`
— `/health` returns `{"status":"ok","engine":"postgres"}`, and a real
`tools/call` search request returns correct, real results matching local
CLI output.

**Current state:** gbrain is fully hosted and working remotely. Remaining
for the Vercel deployment itself: create the Vercel project from the
GitHub repo, set all secrets via Vercel's Environment Variables dashboard
(Google OAuth client, Gemini key, NextAuth secret + production URL,
`GBRAIN_REMOTE_URL`/`GBRAIN_REMOTE_TOKEN`), add the production URL as an
authorized redirect URI in Google Cloud Console (OAuth will 401 otherwise),
deploy, and verify live.

---

## 2026-08-05 — Deployed to Vercel; live at project-main-ai.vercel.app

**Deploy steps:** created the Vercel project from the GitHub repo, set all
6 secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`,
`GOOGLE_GENERATIVE_AI_API_KEY`, `GBRAIN_REMOTE_URL`, `GBRAIN_REMOTE_TOKEN`)
via Vercel's Environment Variables dashboard (never committed to the
repo), deployed.

**Bug hit and fixed — OAuth `redirect_uri_mismatch`.** First live login
attempt failed with Google's `Error 400: redirect_uri_mismatch`, since the
Google Cloud OAuth client only had `localhost:3000`'s callback URL
registered. Added
`https://project-main-ai.vercel.app/api/auth/callback/google` to
Authorized redirect URIs, added `NEXTAUTH_URL` to Vercel's env vars,
redeployed. Verified live — reaches Google's real sign-in screen
correctly afterward.

**Bug hit and fixed — the "Re-sync" button is broken on the deployed
site (as expected, but was never actually disabled there).** User tested
the deployed app and hit "Ingestion sync failed" clicking re-sync. This
is the exact limitation flagged at the very start of the Vercel work:
`/api/ingest/sync` shells out to a local gbrain binary and a local
`brain/` git repo, neither of which exist on Vercel's serverless
functions — only the search/chat path was ever migrated to work
remotely, but the sync button was still visible and wired to the
local-exec code path everywhere. Fixed properly instead of just
explaining it away, since a visibly-broken button in a graded demo looks
bad: `page.tsx` now computes `ingestionEnabled = !process.env.VERCEL`
(Vercel always sets `VERCEL=1`; local `next dev`/`next start` never do)
and threads it down through `Workspace` to `Sidebar`, which shows the
real re-sync button locally but a plain explanatory note
("re-sync runs from local dev only — this deployment reads the same
shared brain") on the deployed site instead. Also added a server-side
guard directly in `/api/ingest/sync` (returns 501 with a clear message
if `process.env.VERCEL` is set) as defense-in-depth, independent of
whatever the UI shows.

**Also clarified for the user:** this app is single-tenant by design
(SPEC.md's explicit "single user" scope) — there's one shared brain in
Supabase, not one per Google account. Logging in with a second Google
account and re-syncing would mix that account's data into the same
brain, not keep it separate. No architecture change made here since it's
out of scope for the assignment; just made sure the user understood the
behavior before they tried it.

**Verified:** `tsc --noEmit`, `eslint src`, `next build` all clean.

**Current state:** App fully deployed and live at
https://project-main-ai.vercel.app — OAuth, chat, and remote-gbrain
search all confirmed working in earlier steps; the ingestion-button fix
above is committed and pushed, awaiting Vercel's auto-redeploy (GitHub
integration) and a final live click-through to confirm the sidebar shows
the correct state on production.

---

## 2026-08-05 — Chat timing out on Vercel; root cause was Render's region

**Context:** User confirmed the ingestion-button fix deployed correctly,
but then hit a real bug testing chat live: a query just hung forever
("BRAIN · 12:17 AM" with an empty pending cursor, no response ever
arrived).

**Diagnosis:** User checked Vercel's Runtime Logs (same technique as the
Render embedding-dimension bug earlier) and found the real error:
`Vercel Runtime Timeout Error: Task timed out after 30 seconds` on
`/api/chat`, repeated across multiple requests. (Also visible in the same
log: `/api/ingest/sync` correctly returned 501 — confirming the earlier
fix worked.)

**First fix attempt — reduce URL-lookup round-trips.** Hypothesis: each
`get_page` call (used to fetch the citation URL) is a separate network
round-trip to the remote gbrain server, and the model can call
`search_gmail`/`search_drive` multiple times per turn with rephrased
queries (observed up to 4x in earlier testing) — each call enriching
every one of its results. Capped URL lookups to the top 3 results by
relevance per call in
[`gbrain-remote.ts`](src/lib/brain/gbrain-remote.ts) (snippets, already
free since they come from the single search response, still cover every
hit for grounding — only the citation *link* is capped). Also bumped
`/api/chat`'s `maxDuration` from 30 to 60 (Vercel Hobby plan's max) as
headroom.

**Verified the fix was insufficient on its own.** A throwaway timed test
script (`generateText` with the same tools, instrumented with per-call
timing) showed the real query — "what are the skills from my
Resume_2026_APRIL" — still took **59-70 seconds** end to end even with
the URL-lookup cap. Per-call timing logs showed why: the `search` MCP
call itself was taking **10-25 seconds per call**, completely dominating
the total — `get_page` calls were only ~2s each and already capped.

**Root cause — Render (Oregon, US West) talking to Supabase (Sydney,
ap-southeast-2) on every single query.** Confirmed by having the user
check Render's Settings → Region. A raw curl timing sweep across
different `limit` values showed latency didn't correlate with result
count (5 results was *slower* than 32), ruling out overfetch size as the
driver and pointing at fixed network/infra latency instead — consistent
with a full US↔Australia round trip (DB query + the Gemini embedding API
call) on every request.

**Render doesn't support changing an existing service's region** (```
"Render doesn't currently support changing the region for an existing
service or database. Instead, create a new service..." ```) — created a
second Render service (`gbrain-server`, same Dockerfile, same env vars)
in **Singapore** (closest available Render region to Sydney) rather than
Oregon. Re-verified timing directly: raw `search` calls dropped from
10-25s to ~7s once warm (first call after deploy was still ~15-17s —
cold start), and the same full end-to-end integration test that took
59-70s against Oregon completed in **30.8s** against Singapore —
comfortably under the 60s ceiling.

**Note:** the new service's hostname is `ersonal-brain-gbrain-sg.onrender.com`
(missing the leading "p") — a naming typo the user made when creating it
in Render, not a copy-paste error (confirmed by checking the exact string
shown in Render's own UI). Harmless since it's just a hostname, but worth
remembering if this needs to be referenced again — it is NOT a typo to
"fix."

**Updated:** `.env.local`'s `GBRAIN_REMOTE_URL` now points at the
Singapore service. Vercel's `GBRAIN_REMOTE_URL` env var needs the same
update (user to do next), followed by a redeploy and final live retest.
The original Oregon Render service is still running but unused — fine to
delete later, not urgent (free tier, no cost either way).

**Current state:** Both the code-level fix (capped URL lookups, 60s
ceiling) and the infra-level fix (Singapore region) are needed together —
neither alone brought total latency reliably under the timeout. Verified
via direct script, not yet reverified through the actual deployed Vercel
app end-to-end (pending Vercel env var update + redeploy + live retest).

---

## 2026-08-05 — Vercel + Singapore fix confirmed live; polished loading state

**Verified live:** user updated Vercel's `GBRAIN_REMOTE_URL` to the
Singapore Render service, redeployed, and confirmed a real chat query
("Summarize Work at Adobe at a stipend mail") completed correctly on the
deployed app — response, formatting, and sources footnote all working.
Also confirmed local dev works identically after restarting with the
updated `.env.local`, since it's the exact same code path. This closes
out the Vercel deployment + latency work.

**UI polish — replaced the loading indicator.** User asked for the
"thinking" state (previously a plain blinking `▌` block) to be replaced
with a smoother, on-theme animation: a sequential-pulse scanner bar
(5 thin cyan bars, staggered `animation-delay` creating a wave via CSS
`@keyframes`, glowing at peak using the existing `--glow-cyan` shadow
token) next to a `[ PROCESSING_DATA... ]` label with a smooth opacity
pulse, the whole thing fading in via a `thinking-fade-in` keyframe rather
than popping in abruptly. Pure CSS (`@keyframes` + `animation-delay`
stagger), no JS animation loop or interval, per the explicit ask.
New [`ThinkingIndicator.tsx`](src/app/chat/ThinkingIndicator.tsx)
component, styles added to
[`globals.css`](src/app/globals.css), wired into
[`MessageBubble.tsx`](src/app/chat/MessageBubble.tsx) in place of the old
inline `▌` span.

**Verified:** `tsc --noEmit`, `eslint src`, `next build` all clean; no
console errors on a live page load. User confirmed visually: "Looks
clean and good."

**Current state:** App is fully deployed, functionally verified end to
end (OAuth, ingestion, remote gbrain search, Gemini reasoning, citations),
and now visually polished. All work from today's Vercel deployment push
is complete.

---

## 2026-08-05 — Declined BYOK; implemented rate-limit/overload error handling

**BYOK declined mid-implementation.** User asked for a "Bring Your Own
Key" architecture so the deployed site could be shared with external
users without burning their personal Gemini quota. Before writing code,
flagged a real gap: the Google OAuth consent screen is still in Testing
mode with a one-email allowlist, and `gmail.readonly`/`drive.readonly`
are Google's restricted-scope tier — going public requires their formal
verification process (privacy policy, security assessment), commonly
weeks, not something achievable before the submission deadline. Even if
login worked, every visitor would be querying the *owner's* shared
Gmail/Drive brain, not their own — no per-user data isolation exists.
User then asked directly whether real multi-tenancy is possible (gbrain
does support the underlying primitives — per-user sources, scoped tokens,
same as their documented "company brain" pattern — but wiring it up is a
genuine re-architecture of auth + ingestion + query-scoping together).
Recommended against pursuing either before the deadline. User agreed and
said to scrap BYOK entirely — no code had been written yet (only research
into the AI SDK's transport header API), so nothing to revert.

**Implemented instead: graceful rate-limit/overload error handling.**
Real problem worth solving regardless of BYOK — Gemini's free tier is
easy to rate-limit into (we hit this ourselves multiple times testing
model choices on 2026-08-04), and the app previously had no handling for
it: a 429/503 mid-stream would just hang the UI forever (empty pending
cursor, no feedback, no way to recover without a page reload).

- [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) — most Gemini
  failures surface *during* streaming, not as a synchronous throw from
  `streamText()` (it returns immediately; the model call happens lazily
  as the stream is consumed) — confirmed by reading the AI SDK's own
  types. Wired a `friendlyErrorMessage()` classifier into
  `toUIMessageStreamResponse({ onError })`, which controls the error text
  embedded directly in the response stream. Classifier unwraps `RetryError`
  (the SDK's own wrapper after exhausting its internal retries) via
  `.lastError` to reach the underlying `APICallError` and its
  `statusCode`: 429 → "high demand" message, 500/503 → "service overload"
  message, other codes → generic upstream-error message with the code
  included, non-API errors → generic fallback (logged server-side for
  debugging). Kept the outer `try/catch` too, for genuinely synchronous
  failures (bad request body, auth) that occur before `streamText` is
  even reached.
- [`src/app/chat/Workspace.tsx`](src/app/chat/Workspace.tsx) — added
  `onError` to `useChat` (fires with an `Error` whose `.message` is
  exactly the string the server crafted — no need to re-classify
  client-side), storing it in a `systemError` state slot; cleared on
  every new send and on retry. Added `retryLastMessage()` using `useChat`'s
  built-in `regenerate()` rather than resending text manually.
- [`src/app/chat/SystemErrorBanner.tsx`](src/app/chat/SystemErrorBanner.tsx)
  (new) — pink/magenta glowing banner matching the existing alert-color
  convention (already used for Send/Disconnect), with a Retry button.
- [`src/app/chat/Chat.tsx`](src/app/chat/Chat.tsx) — renders the banner
  after the message list when `systemError` is set. Also fixed a related
  cosmetic edge case: a failed generation can leave a real-but-empty
  assistant message in the transcript (request errored before any tokens
  arrived) — now skipped once no longer busy, so the error banner isn't
  preceded by an empty floating box.

**Verified:** a standalone script constructing synthetic `APICallError`/
`RetryError` instances (429, 503, 500-wrapped-in-RetryError, and a plain
unclassified `Error`) confirmed all four classification branches produce
the correct message — couldn't reliably force a real 429 from Gemini on
demand without burning quota, so this was the practical way to verify the
logic itself. `tsc --noEmit`, `eslint src`, `next build` all clean; no
console errors on a live page load. Live click-through (including
whether rapid-fire messages naturally trip a real rate limit) requested
from the user.

**Current state:** Error handling implemented and verified at the logic
level; awaiting the user's live confirmation of both the normal path and
(if it naturally triggers) the error path.
