import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listRecentMessages } from "@/lib/google/gmail";
import { listRecentFiles } from "@/lib/google/drive";
import { gmailMessageToBrainDocument, driveFileToBrainDocument } from "@/lib/brain/normalize";
import { writeBrainPages } from "@/lib/brain/write";
import { commitBrainRepo, syncBrain } from "@/lib/brain/gbrain-cli";

const DEFAULT_MAX_PER_SOURCE = 50;

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const [messages, files] = await Promise.all([
      listRecentMessages(session.accessToken, DEFAULT_MAX_PER_SOURCE),
      listRecentFiles(session.accessToken, DEFAULT_MAX_PER_SOURCE),
    ]);

    const docs = [
      ...messages.map(gmailMessageToBrainDocument),
      ...files.map(driveFileToBrainDocument),
    ];

    const paths = await writeBrainPages(docs);
    const commit = await commitBrainRepo(
      `ingest: ${messages.length} gmail message(s), ${files.length} drive file(s)`,
    );
    const syncLog = await syncBrain();

    return NextResponse.json({
      gmailCount: messages.length,
      driveCount: files.length,
      pagesWritten: paths.length,
      committed: commit.committed,
      syncLog,
    });
  } catch (err) {
    console.error("Ingestion sync failed", err);
    return NextResponse.json({ error: "Ingestion sync failed" }, { status: 500 });
  }
}
