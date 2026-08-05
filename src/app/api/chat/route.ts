import { google } from "@ai-sdk/google";
import {
  APICallError,
  RetryError,
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { auth } from "@/auth";
import { brainTools } from "@/lib/query/tools";

// 60s is the max Vercel's Hobby plan allows. Needed as headroom: the model
// can call search_gmail/search_drive multiple times per turn, each one a
// network round-trip to the remote gbrain server (Render) — see
// gbrain-remote.ts's MAX_URL_LOOKUPS cap (JOURNAL.md 2026-08-05) for the
// matching fix on the latency side, not just the ceiling.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Personal Brain, a conversational agent over the user's own Gmail and \
Google Drive, already ingested into a searchable brain.

Rules:
- Answer ONLY using facts returned by the search_gmail / search_drive tools. Never invent details.
- If the tools return nothing relevant, say plainly that you couldn't find it in the connected data \
— do not guess or fabricate an answer. "I don't know" beats a confident wrong answer.
- Some questions need BOTH tools to answer correctly (e.g. "what's my status on job X, including my \
take-home submission" needs an email thread AND a matching Drive file). Call both tools when the \
question could plausibly span sources before answering.
- When you use a result, cite which email or file it came from. Each tool result includes a \`url\` — \
if one is present, cite the source as a markdown link, e.g. [SHORTLISTED STUDENTS](https://mail.google.com/...). \
If a result has no url, just name it in bold instead. This makes every citation clickable, not just a bare claim.
- Be conversational and concise — synthesize an answer, don't dump raw search results.
- Format with markdown: bullet lists for multiple facts, **bold** for key terms, and the link \
syntax above for citations.`;

/**
 * Most Gemini API failures (rate limits, overload) surface DURING streaming,
 * not as a synchronous throw from `streamText()` itself — it returns
 * immediately and the actual model call happens lazily as the stream is
 * consumed. That's why this is wired into `toUIMessageStreamResponse`'s
 * `onError` (which controls the error text embedded in the stream) rather
 * than only a try/catch around `streamText()`. The AI SDK retries
 * transiently-retryable errors internally a few times first and wraps the
 * final failure in a `RetryError` — unwrap `.lastError` to get at the real
 * `APICallError` and its `statusCode`.
 */
function friendlyErrorMessage(error: unknown): string {
  const resolved = RetryError.isInstance(error) ? error.lastError : error;
  const statusCode = APICallError.isInstance(resolved) ? resolved.statusCode : undefined;

  if (statusCode === 429) {
    return "[ ERR_HIGH_DEMAND ] Model is currently experiencing high demand (rate limited). Please wait a moment and try your query again.";
  }
  if (statusCode === 503 || statusCode === 500) {
    return "[ ERR_SERVICE_OVERLOAD ] The model provider is temporarily overloaded. Please retry in a moment.";
  }
  if (statusCode !== undefined) {
    return `[ ERR_UPSTREAM_${statusCode} ] The model provider returned an unexpected error. Please try again.`;
  }

  console.error("Unclassified chat error", error);
  return "[ SYSTEM_ALERT ] Something went wrong generating a response. Please try again.";
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
      // "gemini-flash-latest" resolved to "gemini-3.6-flash" (20 req/DAY free
      // quota) and "gemini-2.0-flash" has ZERO free quota on this key — both
      // verified by direct API probing. "gemini-flash-lite-latest" is the one
      // model confirmed to actually have usable free-tier quota right now.
      // See JOURNAL.md 2026-08-04.
      model: google("gemini-flash-lite-latest"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: brainTools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse({ onError: friendlyErrorMessage });
  } catch (err) {
    // Genuinely synchronous failures only (bad request body, auth, our own
    // code throwing before streamText is ever invoked) — model/API errors
    // are caught above via onError instead.
    console.error("Chat request failed before streaming started", err);
    return new Response(JSON.stringify({ error: friendlyErrorMessage(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
