"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import type { ChatMessage } from "@/components/ChatPanel";
import TripHero from "@/components/TripHero";
import CabinCard from "@/components/CabinCard";
import ShipResearch from "@/components/ShipResearch";
import BordAbc from "@/components/BordAbc";
import CabinResearch from "@/components/CabinResearch";
import { normalizeCabinCategory, extractDeckNumber, cabinLabel } from "@/lib/cabin";
import RouteResearch from "@/components/RouteResearch";
import ExcursionForm from "@/components/ExcursionForm";
import ExcursionCard from "@/components/ExcursionCard";
import PortDaySwiper from "@/components/PortDaySwiper";
import MemoryItem from "@/components/MemoryItem";
import ShareTrip from "@/components/ShareTrip";
import Spinner from "@/components/Spinner";
import TabBar, { type TripTab } from "@/components/TabBar";
import type { TripContext } from "@/lib/trip-context";

export default function TripPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
          <Spinner />
        </main>
      }
    >
      <TripPageContent />
    </Suspense>
  );
}

function TripPageContent() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // "bord-abc" ist kein Bottom-Tab (siehe TabBar.tsx) - eigener, aus der
  // Schiffsinfos-Sektion erreichbarer Screen für die 36 flottenweiten
  // Bordregeln-Themen, damit sie die Reise-Übersicht nicht überfluten.
  type ExtendedTab = TripTab | "bord-abc";
  const activeTab = (searchParams.get("tab") as ExtendedTab | null) ?? "reise";

  function setTab(tab: ExtendedTab) {
    router.push(`${pathname}?tab=${tab}`, { scroll: false });
  }

  const [context, setContext] = useState<TripContext | null>(null);
  const [excursions, setExcursions] = useState<TripContext["excursions"]>([]);
  const [memory, setMemory] = useState<TripContext["memory"]>([]);
  const [portCoordinates, setPortCoordinates] = useState<Record<string, { lat: number; lon: number }>>({});
  const [shipImageUrl, setShipImageUrl] = useState<string | null>(null);
  const [shipImageAttribution, setShipImageAttribution] = useState<string | null>(null);
  const [portPhotos, setPortPhotos] = useState<Record<string, string>>({});
  const [portPhotoAttributions, setPortPhotoAttributions] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
        setIsAdmin(json.isAdmin);
        setPortCoordinates(json.portCoordinates ?? {});
        setShipImageUrl(json.shipImageUrl ?? null);
        setShipImageAttribution(json.shipImageAttribution ?? null);
        setPortPhotos(json.portPhotos ?? {});
        setPortPhotoAttributions(json.portPhotoAttributions ?? {});
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

  const portCallById = new Map(context.port_calls.map((pc) => [pc.id, pc]));
  const bordAbcFindings = context.research.filter((r) => r.category === "bord_abc");

  return (
    <div className="lg:mx-auto lg:flex lg:max-w-7xl lg:items-start lg:gap-10 lg:px-6 lg:pt-12">
      <TabBar active={activeTab === "bord-abc" ? "reise" : activeTab} onChange={setTab} />

      <main className="mx-auto min-h-screen max-w-2xl flex-1 space-y-8 px-6 pb-[104px] pt-12 lg:mx-0 lg:max-w-none lg:px-0 lg:pb-12 lg:pt-0">
        {activeTab === "reise" && (
          <div className="space-y-8 lg:mx-auto lg:max-w-2xl">
            <TripHero
              tripId={tripId}
              trip={context.trip}
              portCalls={context.port_calls}
              excursions={excursions}
              bookings={context.bookings}
              travelers={context.travelers}
              portCoordinates={portCoordinates}
              heroImageUrl={shipImageUrl}
              heroImageAttribution={shipImageAttribution}
            />

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
                {context.bookings.length === 0 && (
                  <p className="text-sm text-ink/50">Noch keine Kabinen hinterlegt.</p>
                )}
              </div>
            </section>

            <ShipResearch
              tripId={tripId}
              initialFindings={context.research.filter(
                (r) => r.port_call_id === null && r.cabin_category === null && r.category !== "bord_abc"
              )}
              isAdmin={isAdmin}
              bordAbcCount={bordAbcFindings.length}
              onOpenBordAbc={() => setTab("bord-abc")}
            />

            <CabinResearch
              tripId={tripId}
              groups={Object.values(
                context.bookings.reduce<
                  Record<string, { label: string; category: string; deck: string | null; cabinNumbers: string[] }>
                >((acc, b) => {
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
                }, {})
              )}
              initialFindings={context.research.filter((r) => r.port_call_id === null && r.cabin_category !== null)}
              isAdmin={isAdmin}
            />

            <RouteResearch findings={context.route_research} />

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

            {isOwner && <ShareTrip tripId={tripId} />}
          </div>
        )}

        {activeTab === "tage" && (
          <PortDaySwiper
            tripId={tripId}
            portCalls={context.port_calls}
            excursions={excursions}
            research={context.research}
            onDeleteExcursion={handleDeleteExcursion}
            isAdmin={isAdmin}
            portPhotos={portPhotos}
            portPhotoAttributions={portPhotoAttributions}
            portCoordinates={portCoordinates}
          />
        )}

        {activeTab === "ausfluege" && (
          <section className="space-y-3 lg:mx-auto lg:max-w-2xl">
            <div>
              <h2 className="font-display text-xl font-medium text-ink">Ausflüge</h2>
              {excursions.length > 0 && (
                <p className="font-mono text-[11px] uppercase tracking-[.14em] text-ink/45">
                  {excursions.length} gebucht
                  {excursions.some((e) => e.price_total != null) && (
                    <>
                      {" "}
                      ·{" "}
                      {excursions.reduce((sum, e) => sum + (e.price_total ?? 0), 0).toFixed(2)}{" "}
                      {excursions.find((e) => e.currency)?.currency ?? "EUR"}
                    </>
                  )}
                </p>
              )}
            </div>
            <ExcursionForm
              tripId={tripId}
              portCalls={context.port_calls}
              onAdded={(e) => setExcursions((prev) => [...prev, e])}
            />
            {excursions.length > 0 ? (
              <ul className="space-y-2">
                {[...excursions]
                  .sort((a, b) => (portCallById.get(a.port_call_id)?.day_number ?? 0) - (portCallById.get(b.port_call_id)?.day_number ?? 0))
                  .map((e) => {
                    const pc = portCallById.get(e.port_call_id);
                    return (
                      <ExcursionCard
                        key={e.id}
                        excursion={e}
                        onDelete={handleDeleteExcursion}
                        dayLabel={pc ? `Tag ${pc.day_number} · ${pc.port_name}` : undefined}
                      />
                    );
                  })}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">Noch keine Ausflüge gebucht.</p>
            )}
          </section>
        )}

        {activeTab === "chat" && (
          <div className="-mx-6 h-[calc(100vh-56px-104px)] min-h-[420px] lg:mx-auto lg:h-[calc(100vh-56px-48px)] lg:max-w-2xl">
            <ChatPanel tripId={tripId} initialMessages={messages} initialMemory={memory} />
          </div>
        )}

        {activeTab === "bord-abc" && (
          <BordAbc findings={bordAbcFindings} onBack={() => setTab("reise")} />
        )}
      </main>
    </div>
  );
}
