import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchFiles } from "@/lib/google/drive";

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
    const files = await searchFiles(session.accessToken, query, maxResults);
    return NextResponse.json({ count: files.length, files });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Drive API request failed" }, { status: 502 });
  }
}
