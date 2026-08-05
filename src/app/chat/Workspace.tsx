"use client";

import { useState } from "react";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";

const TOOL_TYPES = ["tool-search_gmail", "tool-search_drive"] as const;

/** Tool calls in-flight on the current (last) message — not yet output-available/output-error. */
function computeActiveTools(messages: UIMessage[]): string[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return [];

  const active = new Set<string>();
  for (const part of last.parts) {
    if (!(TOOL_TYPES as readonly string[]).includes(part.type)) continue;
    const state = (part as { state?: string }).state;
    if (state === "output-available" || state === "output-error") continue;
    active.add(part.type === "tool-search_gmail" ? "search_gmail" : "search_drive");
  }
  return Array.from(active);
}

export function Workspace({
  email,
  ingestionEnabled,
}: {
  email: string;
  ingestionEnabled: boolean;
}) {
  // useChat's sendMessage({ messageId }) REPLACES an existing message with
  // that id — it doesn't let you assign an id to a new one — so a real id
  // for the user's own message isn't knowable until the hook creates it.
  // Simplest correct fix: stamp by POSITION instead of id. Each user
  // message gets the next entry in this array, in send order; Chat.tsx
  // looks it up by counting user messages as it renders them.
  const [userTimestamps, setUserTimestamps] = useState<number[]>([]);
  const [assistantTimestamps, setAssistantTimestamps] = useState<Record<string, number>>({});
  const [systemError, setSystemError] = useState<string | null>(null);

  const chat: UseChatHelpers<UIMessage> = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Stamps the assistant message's timestamp once it finishes streaming —
    // this DOES give us the real final id, unlike the user side above.
    onFinish: ({ message }) => {
      setAssistantTimestamps((prev) => ({ ...prev, [message.id]: Date.now() }));
    },
    // Fires for both stream-embedded errors (rate limits/overload surfaced
    // via the API route's onError, see route.ts) and network-level failures.
    // error.message is already the human-readable string the server crafted.
    onError: (error) => {
      setSystemError(error.message);
    },
  });

  const activeTools = computeActiveTools(chat.messages);

  function sendStampedMessage(text: string) {
    setSystemError(null);
    setUserTimestamps((prev) => [...prev, Date.now()]);
    void chat.sendMessage({ text });
  }

  function retryLastMessage() {
    setSystemError(null);
    void chat.regenerate();
  }

  return (
    <div className="flex h-screen w-screen gap-4 overflow-hidden p-4">
      <Sidebar email={email} activeTools={activeTools} ingestionEnabled={ingestionEnabled} />
      <main className="flex min-w-0 flex-1 flex-col">
        <Chat
          messages={chat.messages}
          status={chat.status}
          userTimestamps={userTimestamps}
          assistantTimestamps={assistantTimestamps}
          onSend={sendStampedMessage}
          systemError={systemError}
          onRetry={retryLastMessage}
        />
      </main>
    </div>
  );
}
