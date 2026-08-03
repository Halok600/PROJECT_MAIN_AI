import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchMessages } from "@/lib/google/gmail";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const maxResults = Number(req.nextUrl.searchParams.get("max") ?? "10");

  try {
    const messages = await searchMessages(session.accessToken, query, maxResults);
    return NextResponse.json({ count: messages.length, messages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gmail API request failed" }, { status: 502 });
  }
}
