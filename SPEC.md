# SPEC.md — Personal Brain

Status: DRAFT v1 — written before implementation, per SDD requirement.
Owner: Priyanshu Kumar Tiwari
Target: SkillLayer SDE I take-home, due 2026-08-09 00:00.

## 1. Problem statement

Build a conversational agent that answers natural-language questions by pulling
facts from at least two connected personal data sources and reasoning across
them in a single answer. Not a search UI — a chat interface that gives
grounded, conversational answers.

## 2. Scope

### In scope
- Two connectors: **Gmail** and **Google Drive** (same OAuth consent screen,
  same Google API surface — lowest auth overhead for a 6-day solo build).
- Ingestion pipeline that pulls data from both into local storage backed by
  **gbrain** (https://github.com/garrytan/gbrain).
- A retrieval + reasoning layer that can answer:
  - **Tier 1** (single source): "What's on my calendar tomorrow?" (if Calendar
    added) / "Find the email from Stripe about the failed payment." / "List my
    unread Slack DMs this week" (N/A if Slack not connected — substitute
    Gmail/Drive equivalents, see §5).
  - **Tier 2** (cross-source correlation): "What jobs have I applied to, and
    what's my status on each, including my take-home submission?" and "Did I
    ever send X the contract draft, and did they reply?"
- A chat UI (Next.js web app), deployed to Vercel, with streaming responses.
- JOURNAL.md tracking decisions, trade-offs, and prompt iteration as we build.

### Out of scope (explicitly, to protect the timeline)
- Multi-user auth / account management — single user (me), OAuth to my own
  Google account only.
- Write actions (sending email, modifying Drive files) — read-only agent.
- Real-time sync / webhooks — batch ingestion on demand or on a timer.
- Slack/Notion connectors — deferred; Gmail+Drive is sufficient to satisfy
  "at least two tools" and Tier 2 examples are Gmail×Drive by design in the
  prompt itself.
- Fine-grained permission scoping UI — single hardcoded OAuth scope set.

## 3. Architecture

**Update (2026-08-03):** gbrain is not an embeddable npm library — it's a
Bun-based CLI + MCP server backed by its own Postgres/PGLite database and a
git-tracked "brain repo" of markdown pages. It cannot run inside a Vercel
serverless function (no persistent local DB, no Bun runtime there). Decision:
host gbrain separately (`gbrain serve --http` on a small always-on box —
Railway or Fly.io free tier) and have the Vercel-deployed Next.js app call it
remotely over its HTTP/MCP interface with a bearer token. See JOURNAL.md entry
2026-08-03 for the full trade-off discussion.

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Next.js App (Vercel)  │        │  gbrain host (Railway/Fly.io) │
│                         │        │                                │
│  Chat UI (App Router)   │  HTTP  │  gbrain serve --http           │
│  /api/chat (streaming)  │◀──────▶│  (bearer token auth)           │
│  /api/ingest/gmail      │        │  Postgres/PGLite + brain repo   │
│  /api/ingest/drive      │        │  gbrain search / gbrain think  │
│  /api/auth/google       │        └──────────────────────────────┘
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   Ingestion pipeline      │
│  - Gmail API client       │
│  - Drive API client       │
│  - Normalizer (→ gbrain   │
│    markdown page schema)  │──▶ writes pages, then calls gbrain's
└───────────────────────────┘    remote /ingest or sync endpoint

┌───────────────────────────┐
│  Query / reasoning layer   │
│  - Router: Tier1 vs Tier2  │
│  - Calls gbrain search/    │
│    think over HTTP         │
│  - Cross-source join       │
│    (email↔drive matching)  │
│  - Gemini (Google AI API)  │
│    for routing + final     │
│    synthesis                │
└───────────────────────────┘
```

**Update (2026-08-04):** Reasoning/routing model switched from Claude
(Anthropic) to **Gemini** — one Google AI API key now covers both gbrain's
embeddings and the app's own query routing/synthesis, removing the
Anthropic dependency entirely. See JOURNAL.md entry 2026-08-04.

## 4. Data model

Every ingested item (email, drive file) is normalized to a common shape, then
serialized as a markdown page (frontmatter + body, gbrain's native format)
before being written into the brain repo, so retrieval and cross-source joins
don't need to know source-specific schemas. `BrainDocument` below is the
in-memory shape used by our normalizer before it's rendered to markdown:

```ts
type BrainDocument = {
  id: string;              // source-prefixed unique id, e.g. "gmail:<messageId>"
  source: "gmail" | "drive";
  title: string;            // subject line / file name
  body: string;             // email plaintext body / extracted doc text
  participants?: string[];  // email addresses involved (to/from/cc), for joins
  attachments?: { name: string; driveFileId?: string }[];
  timestamp: string;        // ISO 8601
  raw: Record<string, unknown>; // original API payload, for debugging/audit
};
```

Cross-source correlation (Tier 2) works by matching on: shared participant
email address, filename similarity between an email attachment name and a
Drive file name, and thread/subject text overlap. This is the join logic that
makes "did I send Priya the contract, did she reply" answerable.

## 5. Concrete target queries

Tier 1 (must work):
1. "Find the email from Stripe about the failed payment."
2. "What Drive files have I edited/shared in the last week?"
3. "Summarize my most recent email thread with [X]."

Tier 2 (must attempt, at least one working live):
1. "What jobs have I applied to, and what's my status on each, including my
   take-home submission?" — join: Gmail application/status threads ↔ Drive
   files matching attachment names sent in those threads.
2. "Did I ever send [Person] the contract draft, and did they reply?" — join:
   Gmail sent-mail search by recipient + subject/attachment keyword ↔ Drive
   file of matching name ↔ Gmail reply-thread check.

## 6. Query engine

- **Router**: given a user question, classify as Tier 1 (single source) or
  Tier 2 (needs join), and decide which source(s) to query. Implemented as a
  Gemini function-calling loop (via the `ai` SDK's Google provider) with two
  tools: `search_gmail`, `search_drive`, plus a `correlate` step that's really
  just prompting Gemini with both result sets and asking it to reason across
  them — no bespoke join algorithm required beyond the participant/filename
  heuristics in §4.
- **Grounding rule**: the model only answers from retrieved documents. If
  nothing relevant is retrieved, it says so rather than fabricating — this is
  an explicit judged criterion.
- **Streaming**: responses stream token-by-token to the UI via Vercel AI SDK.

## 7. UI

- Single-page chat interface (Next.js): message list, input box, streaming
  assistant responses, and a lightweight "sources" footnote per answer
  (which emails/files it drew from) so correctness is auditable during the
  live demo.
- A "Connect Google Account" screen precedes chat if no OAuth token is stored.
- A manual "Re-sync" button triggers re-ingestion (no background jobs needed
  for a take-home demo).

## 8. Phasing (see JOURNAL.md for live status)

1. **Phase 1 — Backend**: Next.js scaffold, Google OAuth, Gmail + Drive API
   clients, ingestion pipeline, gbrain integration, normalized storage.
2. **Phase 2 — Reasoning**: retrieval over gbrain, Gemini function-calling
   router, Tier 1 answers working, Tier 2 join logic and prompts, eval
   against §5 query list.
3. **Phase 3 — Frontend**: chat UI, streaming wiring, sources footnote,
   connect/re-sync screens, deploy to Vercel.

Each phase ends with a checkpoint against this spec before moving on.

## 9. Success criteria / definition of done

- [ ] Deployed (Vercel) or reliably local-runnable chat UI, no curl demo.
- [ ] All 3 Tier 1 queries answered correctly live against real connected data.
- [ ] At least 1 Tier 2 query answered correctly live, showing the cross-source
      join.
- [ ] No fabricated answers observed during a full test pass — every claim
      traces to a retrieved document, or the system says it doesn't know.
- [ ] SPEC.md changes are logged in JOURNAL.md when implementation deviates
      from this document.

## 10. Known risks

- **gbrain API surface unknown until we init it** — if it doesn't cleanly fit
  the BrainDocument model above, we document the deviation in JOURNAL.md and
  adapt (e.g. thin adapter layer) rather than fighting it.
- **Google OAuth verification screens** for unverified apps can add friction —
  mitigated by using a personal/test Google account in "testing" publish
  status, which allows the required scopes for the account owner without app
  review.
- **6-day timeline** — Slack/Notion connectors and advanced sync are cut
  first if time is tight; Tier 2 correctness is prioritized over breadth.
