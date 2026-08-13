"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import TripHero from "@/components/TripHero";
import CabinCard from "@/components/CabinCard";
import type { ChatMessage } from "@/components/ChatPanel";
import ShipResearch from "@/components/ShipResearch";
import PortResearch from "@/components/PortResearch";
import ExcursionForm from "@/components/ExcursionForm";
import ExcursionCard from "@/components/ExcursionCard";
import MarkdownText from "@/components/MarkdownText";
import type { TripContext } from "@/lib/trip-context";

export default function TripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [context, setContext] = useState<TripContext | null>(null);
  const [excursions, setExcursions] = useState<TripContext["excursions"]>([]);
  const [memory, setMemory] = useState<TripContext["memory"]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen.");
        setContext(json.context);
        setExcursions(json.context.excursions);
        setMemory(json.context.memory);
        setMessages(json.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tripId]);

  async function handleDeleteExcursion(id: string) {
    try {
      const res = await fetch(`/api/excursions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Löschen fehlgeschlagen.");
      setExcursions((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    }
  }

  async function handleUnmark(id: string) {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Entfernen fehlgeschlagen.");
      setMemory((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <p className="text-ink/60">Lädt …</p>
      </main>
    );
  }

  if (error || !context) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? "Reise nicht gefunden."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-8 px-6 py-12">
      <TripHero tripId={tripId} trip={context.trip} portCalls={context.port_calls} />

      {/* Reiseinfos, zusammengefasst: Eckdaten + Kabinen/Reisende in einem Block */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium text-ink">Reiseinfos</h2>
        {(context.trip.start_port || context.trip.end_port) && (
          <p className="text-sm text-ink/80">
            {context.trip.start_port && <>Start: {context.trip.start_port}</>}
            {context.trip.start_port && context.trip.end_port && " · "}
            {context.trip.end_port && <>Ende: {context.trip.end_port}</>}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {context.bookings.map((b) => (
            <CabinCard
              key={b.id}
              booking={b}
              travelers={context.travelers.filter((t) => t.cabin_number === b.cabin_number)}
            />
          ))}
          {context.bookings.length === 0 && <p className="text-sm text-ink/50">Keine Kabinen erfasst.</p>}
        </div>
      </section>

      <ShipResearch tripId={tripId} initialFindings={context.research.filter((r) => r.port_call_id === null)} />

      {/* Häfen und Ausflüge: pro Hafentag Recherche und gebuchte Ausflüge zusammen */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium text-ink">Häfen und Ausflüge</h2>
        <ExcursionForm
          tripId={tripId}
          portCalls={context.port_calls}
          onAdded={(e) => setExcursions((prev) => [...prev, e])}
        />
        <div className="space-y-2">
          {context.port_calls.map((pc) => (
            <div key={pc.id} className="rounded-lg border border-ink/10 p-3 text-sm text-ink/80">
              <p>
                Tag {pc.day_number} ({pc.call_date}): {pc.is_sea_day ? "Seetag" : pc.port_name}
                {!pc.is_sea_day && (
                  <>
                    {" — "}
                    An: {pc.arrival_time ?? "unbekannt"}, Ab: {pc.departure_time ?? "unbekannt"}
                  </>
                )}
              </p>
              {!pc.is_sea_day && (
                <>
                  <ul className="mt-2 space-y-2">
                    {excursions
                      .filter((e) => e.port_call_id === pc.id)
                      .map((e) => (
                        <ExcursionCard key={e.id} excursion={e} onDelete={handleDeleteExcursion} />
                      ))}
                  </ul>
                  <PortResearch
                    tripId={tripId}
                    portCallId={pc.id}
                    initialFindings={context.research.filter((r) => r.port_call_id === pc.id)}
                  />
                </>
              )}
            </div>
          ))}
          {context.port_calls.length === 0 && <p className="text-sm text-ink/50">Kein Reiseverlauf erfasst.</p>}
        </div>
      </section>

      {memory.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-medium text-ink">Gemerkt</h2>
          <ul className="space-y-2">
            {memory.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-fjord/20 bg-fjord-light/30 p-3 text-sm text-ink/80"
              >
                <MarkdownText text={m.content} />
                <button
                  onClick={() => handleUnmark(m.id)}
                  className="shrink-0 text-xs text-ink/40 hover:text-red-700"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChatWidget tripId={tripId} initialMessages={messages} initialMemory={memory} />
    </main>
  );
}
