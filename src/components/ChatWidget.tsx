"use client";

import { useState } from "react";
import ChatPanel, { type ChatMessage, type MemoryEntry } from "@/components/ChatPanel";

interface ChatWidgetProps {
  tripId: string;
  initialMessages: ChatMessage[];
  initialMemory: MemoryEntry[];
}

export default function ChatWidget({ tripId, initialMessages, initialMemory }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[70vh] max-h-[560px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-mist shadow-xl">
          <div className="flex shrink-0 items-center justify-between bg-fjord-dark px-4 py-3">
            <h2 className="font-display text-lg font-medium text-white">Fragen zu dieser Reise</h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Chat schließen"
              className="text-fjord-light/70 hover:text-white"
            >
              ✕
            </button>
          </div>
          <ChatPanel tripId={tripId} initialMessages={initialMessages} initialMemory={initialMemory} />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-fjord text-white shadow-lg transition hover:bg-fjord-dark"
        aria-label={open ? "Chat einklappen" : "Chat öffnen"}
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <span className="text-2xl">💬</span>
        )}
      </button>
    </div>
  );
}
