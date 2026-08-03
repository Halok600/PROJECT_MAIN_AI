import { stringify } from "yaml";
import type { BrainDocument } from "./types";

/** gbrain-base-v2 path prefixes: "email" -> emails/, "source" (generic doc) -> sources/. */
const TYPE_BY_SOURCE: Record<BrainDocument["source"], { type: string; dir: string }> = {
  gmail: { type: "email", dir: "emails" },
  drive: { type: "source", dir: "sources" },
};

/** Filesystem/slug-safe id: "gmail:19fc76dd1908a913" -> "gmail-19fc76dd1908a913". */
export function slugify(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function brainDocumentToMarkdown(doc: BrainDocument): string {
  const { type } = TYPE_BY_SOURCE[doc.source];

  const frontmatter = stringify({
    type,
    title: doc.title,
    source: doc.source,
    source_id: doc.id,
    date: doc.timestamp,
    url: doc.url,
    participants: doc.participants,
    attachments: doc.attachments.map((a) => a.name),
  });

  return `---\n${frontmatter}---\n\n${doc.body}\n`;
}

export function brainDocumentPagePath(doc: BrainDocument): string {
  const { dir } = TYPE_BY_SOURCE[doc.source];
  return `${dir}/${slugify(doc.id)}.md`;
}
