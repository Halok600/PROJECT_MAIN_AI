import type { GmailMessage } from "@/lib/google/gmail";
import type { DriveFile } from "@/lib/google/drive";
import type { BrainDocument } from "./types";

function extractEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim().toLowerCase();
}

export function gmailMessageToBrainDocument(message: GmailMessage): BrainDocument {
  const participants = [message.from, ...message.to, ...message.cc]
    .filter(Boolean)
    .map(extractEmailAddress);

  return {
    id: `gmail:${message.id}`,
    source: "gmail",
    title: message.subject || "(no subject)",
    body: message.body || message.snippet,
    participants: Array.from(new Set(participants)),
    attachments: message.attachments.map((a) => ({ name: a.filename })),
    timestamp: message.date,
    url: `https://mail.google.com/mail/u/0/#all/${message.threadId}`,
    raw: message,
  };
}

export function driveFileToBrainDocument(file: DriveFile): BrainDocument {
  return {
    id: `drive:${file.id}`,
    source: "drive",
    title: file.name || "(untitled)",
    body: file.content,
    participants: file.owners.map((o) => o.toLowerCase()),
    attachments: [{ name: file.name, driveFileId: file.id }],
    timestamp: file.modifiedTime,
    url: file.webViewLink,
    raw: file,
  };
}
