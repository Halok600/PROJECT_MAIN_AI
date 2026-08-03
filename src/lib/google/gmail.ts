import { google, gmail_v1 } from "googleapis";

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string; // ISO 8601
  snippet: string;
  body: string; // plain text, best-effort extracted
  attachments: { filename: string; attachmentId: string; mimeType: string }[];
  labelIds: string[];
};

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(html: string): string {
  const withoutNonContent = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withoutTags = withoutNonContent.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withoutTags).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    // Prefer text/plain; fall back to stripping tags from text/html if that's all we have.
    const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data);

    for (const part of payload.parts) {
      const nested = extractPlainText(part);
      if (nested) return nested;
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return htmlToText(decodeBase64Url(htmlPart.body.data));
    }
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return htmlToText(decodeBase64Url(payload.body.data));
  }

  return "";
}

function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): GmailMessage["attachments"] {
  if (!payload) return [];
  const attachments: GmailMessage["attachments"] = [];

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType ?? "application/octet-stream",
      });
    }
    part.parts?.forEach(walk);
  }

  walk(payload);
  return attachments;
}

function toGmailMessage(message: gmail_v1.Schema$Message): GmailMessage {
  const headers = message.payload?.headers;
  const to = headerValue(headers, "To");
  const cc = headerValue(headers, "Cc");

  return {
    id: message.id!,
    threadId: message.threadId!,
    subject: headerValue(headers, "Subject"),
    from: headerValue(headers, "From"),
    to: to ? to.split(",").map((s) => s.trim()) : [],
    cc: cc ? cc.split(",").map((s) => s.trim()) : [],
    date: new Date(Number(message.internalDate)).toISOString(),
    snippet: message.snippet ?? "",
    body: extractPlainText(message.payload),
    attachments: extractAttachments(message.payload),
    labelIds: message.labelIds ?? [],
  };
}

/**
 * Search Gmail with a raw Gmail search query (same syntax as the Gmail search box,
 * e.g. "from:stripe.com failed payment", "newer_than:7d").
 */
export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 25,
): Promise<GmailMessage[]> {
  const gmail = getClient(accessToken);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const ids = list.data.messages ?? [];
  if (ids.length === 0) return [];

  const messages = await Promise.all(
    ids.map((m) =>
      gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" }).then((r) => r.data),
    ),
  );

  return messages.map(toGmailMessage);
}

export async function listRecentMessages(accessToken: string, maxResults = 25) {
  return searchMessages(accessToken, "", maxResults);
}
