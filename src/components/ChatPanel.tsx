"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownText from "@/components/MarkdownText";
import { StarIcon } from "@/components/icons";

// Statische Vorschläge - die App kennt keine "häufigen Fragen"-Statistik,
// diese Beispiele orientieren sich an den Feldern, die während der Reise am
// öftesten gebraucht werden (Kabine, Ausflüge, Kleidung).
const SUGGESTION_PILLS = ["Kabinennummer?", "Dresscode abends?", "Wann legen wir an?"];

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
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-logbook/50">
            Stell eine Frage zu Terminen, Kabinen oder Reisenden dieser Reise.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                "inline-block max-w-[78%] px-3 py-2 text-left text-[13.5px] leading-[1.45] " +
                (m.role === "user"
                  ? "rounded-[16px_16px_4px_16px] bg-sea text-[#FDF8F0]"
                  : "max-w-[84%] rounded-[16px_16px_16px_4px] border border-logbook/12 bg-card text-logbook")
              }
            >
              <MarkdownText text={m.content} />
            </span>
            {m.role === "assistant" && (
              <div>
                <button
                  onClick={() => (markedMap.has(m.content) ? unmarkImportant(m.content) : markImportant(m.content))}
                  disabled={marking === m.content}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-logbook/40 hover:text-stamp disabled:cursor-default"
                  title={markedMap.has(m.content) ? "Markierung aufheben" : undefined}
                >
                  {marking === m.content ? (
                    "Wird aktualisiert …"
                  ) : markedMap.has(m.content) ? (
                    <span className="text-stamp-deep">✓ Gemerkt — steht jetzt auf der Reiseseite</span>
                  ) : (
                    <>
                      <StarIcon className="h-3.5 w-3.5" /> Als wichtig markieren
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <p className="text-sm text-logbook/40">Antwort wird erstellt …</p>}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 space-y-2 border-t border-logbook/12 p-3">
        {error && <div className="rounded-[14px] bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {SUGGESTION_PILLS.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => sendMessage(pill)}
              disabled={sending}
              className="shrink-0 rounded-full border border-logbook/15 px-3 py-1.5 text-xs text-logbook/65 hover:border-stamp hover:text-stamp disabled:opacity-40"
            >
              {pill}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="z. B. Wann legen wir in Geiranger an?"
            className="h-[46px] flex-1 rounded-[14px] border border-logbook/15 px-3 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-stamp text-lg font-medium text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Senden"
          >
            {sending ? "…" : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}
