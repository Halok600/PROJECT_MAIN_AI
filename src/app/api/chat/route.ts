import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { auth } from "@/auth";
import { brainTools } from "@/lib/query/tools";

export const maxDuration = 30;

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

export async function POST(req: Request) {
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

  return result.toUIMessageStreamResponse();
}
