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
- When you use a result, mention which email or file it came from (by title/subject) so the answer is \
auditable, not just a bare claim.
- Be conversational and concise — synthesize an answer, don't dump raw search results.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: brainTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
