"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import TripHero from "@/components/TripHero";
import CabinCard from "@/components/CabinCard";
import type { ChatMessage } from "@/components/ChatPanel";
import ShipResearch from "@/components/ShipResearch";
import CabinResearch from "@/components/CabinResearch";
import { normalizeCabinCategory, extractDeckNumber, cabinLabel } from "@/lib/cabin";
import PortResearch from "@/components/PortResearch";
import RouteResearch from "@/components/RouteResearch";
import ExcursionForm from "@/components/ExcursionForm";
import PortDaySwiper from "@/components/PortDaySwiper";
import MemoryItem from "@/components/MemoryItem";
import ShareTrip from "@/components/ShareTrip";
import Spinner from "@/components/Spinner";
import type { TripContext } from "@/lib/trip-context";

export default function TripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [context, setContext] = useState<TripContext | null>(null);
  const [excursions, setExcursions] = useState<TripContext["excursions"]>([]);
  const [memory, setMemory] = useState<TripContext["memory"]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOwner, setIsOwner] = useState(false);
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
        setIsOwner(json.isOwner);
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
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <Spinner />
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
    <main className="mx-auto min-h-screen max-w-2xl space-y-8 px-6 pb-28 pt-12">
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
          {context.bookings.length === 0 && <p className="text-sm text-ink/50">Noch keine Kabinen hinterlegt.</p>}
        </div>
      </section>

      <ShipResearch
        tripId={tripId}
        initialFindings={context.research.filter((r) => r.port_call_id === null && r.cabin_category === null)}
      />

      <CabinResearch
        tripId={tripId}
        groups={Object.values(
          context.bookings.reduce<Record<string, { label: string; category: string; deck: string | null; cabinNumbers: string[] }>>(
            (acc, b) => {
              if (!b.cabin_type) return acc;
              const category = normalizeCabinCategory(b.cabin_type);
              if (!category) return acc;
              const deck = b.cabin_number ? extractDeckNumber(b.cabin_number) : null;
              const label = cabinLabel(category, deck);
              const group = acc[label] ?? { label, category, deck, cabinNumbers: [] };
              if (b.cabin_number && !group.cabinNumbers.includes(b.cabin_number)) {
                group.cabinNumbers.push(b.cabin_number);
              }
              acc[label] = group;
              return acc;
            },
            {}
          )
        )}
        initialFindings={context.research.filter((r) => r.port_call_id === null && r.cabin_category !== null)}
      />

      <RouteResearch findings={context.route_research} />

      {/* Häfen und Ausflüge: pro Hafentag Recherche und gebuchte Ausflüge zusammen */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium text-ink">Häfen und Ausflüge</h2>
        <ExcursionForm
          tripId={tripId}
          portCalls={context.port_calls}
          onAdded={(e) => setExcursions((prev) => [...prev, e])}
        />
        <PortDaySwiper
          tripId={tripId}
          portCalls={context.port_calls}
          excursions={excursions}
          research={context.research}
          onDeleteExcursion={handleDeleteExcursion}
        />
      </section>

      {memory.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-medium text-ink">Gemerkt</h2>
          <ul className="space-y-2">
            {memory.map((m) => (
              <MemoryItem key={m.id} content={m.content} onDelete={() => handleUnmark(m.id)} />
            ))}
          </ul>
        </section>
      )}

      <ChatWidget tripId={tripId} initialMessages={messages} initialMemory={memory} />

      {isOwner && <ShareTrip tripId={tripId} />}
    </main>
  );
}
