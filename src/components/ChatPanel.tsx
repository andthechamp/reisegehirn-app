"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownText from "@/components/MarkdownText";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
}

interface ChatPanelProps {
  tripId: string;
  initialMessages: ChatMessage[];
  initialMemory: MemoryEntry[];
}

export default function ChatPanel({ tripId, initialMessages, initialMemory }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bildet content -> memory-id ab, damit sich eine Markierung auch wieder
  // aufheben lässt (dafür braucht man die id der user_memory-Zeile).
  const [markedMap, setMarkedMap] = useState<Map<string, string>>(
    new Map(initialMemory.map((m) => [m.content, m.id]))
  );
  const [marking, setMarking] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  async function markImportant(content: string) {
    if (markedMap.has(content) || marking) return;
    setMarking(content);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Merken fehlgeschlagen.");
      setMarkedMap((prev) => new Map(prev).set(content, json.memory.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setMarking(null);
    }
  }

  async function unmarkImportant(content: string) {
    const id = markedMap.get(content);
    if (!id || marking) return;
    setMarking(content);
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Entfernen fehlgeschlagen.");
      setMarkedMap((prev) => {
        const next = new Map(prev);
        next.delete(content);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setMarking(null);
    }
  }

  async function sendMessage(text: string) {
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Antwort fehlgeschlagen.");
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    sendMessage(input.trim());
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-ink/50">
            Stell eine Frage zu Terminen, Kabinen oder Reisenden dieser Reise.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                "inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-sm " +
                (m.role === "user" ? "bg-fjord text-white" : "bg-fjord-light text-ink")
              }
            >
              <MarkdownText text={m.content} />
            </span>
            {m.role === "assistant" && (
              <div>
                <button
                  onClick={() => (markedMap.has(m.content) ? unmarkImportant(m.content) : markImportant(m.content))}
                  disabled={marking === m.content}
                  className="mt-1 text-xs font-medium text-ink/40 hover:text-fjord disabled:cursor-default"
                  title={markedMap.has(m.content) ? "Markierung aufheben" : undefined}
                >
                  {marking === m.content
                    ? "Wird aktualisiert …"
                    : markedMap.has(m.content)
                      ? "✓ Gemerkt (klicken zum Aufheben)"
                      : "★ Als wichtig markieren"}
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <p className="text-sm text-ink/40">Antwort wird erstellt …</p>}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 space-y-2 border-t border-ink/10 p-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="z. B. Wann legen wir in Geiranger an?"
            className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-fjord focus:outline-none focus:ring-1 focus:ring-fjord"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-fjord px-4 py-2 text-sm font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "…" : "Senden"}
          </button>
        </div>
      </div>
    </div>
  );
}
