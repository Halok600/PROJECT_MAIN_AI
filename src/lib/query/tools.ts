import { tool } from "ai";
import { z } from "zod";
import { searchGmail, searchDrive } from "@/lib/brain/gbrain-cli";

function formatHits(hits: Awaited<ReturnType<typeof searchGmail>>) {
  if (hits.length === 0) {
    return { count: 0, results: [] };
  }
  return {
    count: hits.length,
    results: hits.map((h) => ({
      slug: h.slug,
      title: h.title,
      score: h.score,
      snippet: h.snippet,
    })),
  };
}

export const searchGmailTool = tool({
  description:
    "Search the user's Gmail (already ingested into the brain) for emails matching a query. " +
    "Use natural-language or keyword queries, e.g. 'Stripe failed payment', 'job application status'.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in the user's emails"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => formatHits(await searchGmail(query, limit)),
});

export const searchDriveTool = tool({
  description:
    "Search the user's Google Drive files (already ingested into the brain) for documents matching a query. " +
    "Use natural-language or keyword queries, e.g. 'contract draft', 'take-home submission'.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in the user's Drive files"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => formatHits(await searchDrive(query, limit)),
});

export const brainTools = {
  search_gmail: searchGmailTool,
  search_drive: searchDriveTool,
};
