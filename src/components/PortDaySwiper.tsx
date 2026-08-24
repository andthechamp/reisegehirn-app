"use client";

import { useRef, useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ExcursionCard from "@/components/ExcursionCard";
import PortResearch from "@/components/PortResearch";
import RouteMap, { type RouteMapPort } from "@/components/RouteMap";

type PortCall = TripContext["port_calls"][number];
type Excursion = TripContext["excursions"][number];
type Finding = TripContext["research"][number];

interface PortDaySwiperProps {
  tripId: string;
  portCalls: PortCall[];
  excursions: Excursion[];
  research: Finding[];
  onDeleteExcursion: (id: string) => void;
  isAdmin: boolean;
  // port_name -> Foto-URL, via resolvePortPhoto() serverseitig aufgelöst
  // (siehe /api/trips/[id]/route.ts) - Häfen ohne Treffer fehlen im Objekt.
  portPhotos: Record<string, string>;
  // port_name -> Attribution, nur bei Commons-Fotos gesetzt (CC-BY-SA-
  // Namensnennungspflicht).
  portPhotoAttributions: Record<string, string>;
  // port_name -> Koordinaten, für die Desktop-Kartenansicht (ersetzt ab lg
  // das Chip-Carousel, siehe RouteMap).
  portCoordinates: Record<string, { lat: number; lon: number }>;
}

// Swipe gilt erst ab dieser Distanz als Geste, sonst würde ein normaler Tap
// (der minimal wackelt) versehentlich als Wisch erkannt.
const SWIPE_THRESHOLD_PX = 40;

export default function PortDaySwiper({
  tripId,
  portCalls,
  excursions,
  research,
  onDeleteExcursion,
  isAdmin,
  portPhotos,
  portPhotoAttributions,
  portCoordinates,
}: PortDaySwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (portCalls.length === 0) {
    return <p className="text-sm text-ink/50">Noch kein Reiseverlauf hinterlegt.</p>;
  }

  const active = portCalls[activeIndex];
  const goTo = (i: number) => setActiveIndex(Math.max(0, Math.min(portCalls.length - 1, i)));

  // Für die Desktop-Karte: einfache Vergangenheit/heute/zukunft-Einordnung
  // reicht hier, anders als im Reise-Hero geht es nur um Tagesnavigation,
  // nicht um Ausflugs-Erinnerungen.
  const todayStr = new Date().toISOString().slice(0, 10);
  const mapPorts: RouteMapPort[] = portCalls.flatMap((pc) => {
    if (pc.is_sea_day) return [];
    const coord = portCoordinates[pc.port_name];
    if (!coord) return [];
    const state: RouteMapPort["state"] = pc.call_date < todayStr ? "done" : pc.call_date > todayStr ? "upcoming" : "today";
    return [{ port_name: pc.port_name, lat: coord.lat, lon: coord.lon, day_number: pc.day_number, state }];
  });
  const stampLabel = new Date(`${active.call_date}T00:00:00`)
    .toLocaleDateString("de-DE", { day: "2-digit", month: "long" })
    .toUpperCase();
  const photoUrl = active.is_sea_day ? undefined : portPhotos[active.port_name];
  const photoAttribution = active.is_sea_day ? undefined : portPhotoAttributions[active.port_name];
  const stampBadge = (
    <span className="inline-block rotate-[-4deg] whitespace-nowrap rounded-full border-[1.5px] border-stamp bg-[rgba(253,248,240,.86)] px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[.1em] text-stamp-deep">
      Tag {String(active.day_number).padStart(2, "0")} · {stampLabel}
    </span>
  );

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) {
      goTo(activeIndex + (delta < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  }

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[380px_1fr] lg:items-start lg:gap-6 lg:space-y-0">
      {mapPorts.length > 0 && (
        <div className="hidden h-[420px] overflow-hidden rounded-[18px] border border-ink/12 lg:sticky lg:top-6 lg:block">
          <RouteMap
            ports={mapPorts}
            selectedDayNumber={active.day_number}
            onSelectPort={(p) => {
              const i = portCalls.findIndex((pc) => pc.day_number === p.day_number);
              if (i >= 0) goTo(i);
            }}
          />
        </div>
      )}

      <div className="flex w-full overflow-x-auto pb-1 lg:hidden">
        <div className="flex w-max gap-1">
          {portCalls.map((pc, i) => (
            <button
              key={pc.id}
              onClick={() => goTo(i)}
              className={
                "flex w-[62px] shrink-0 flex-col items-center rounded-[12px] px-1 py-1.5 text-center transition " +
                (i === activeIndex ? "bg-stamp" : "hover:bg-paper-deep")
              }
            >
              <span className={"font-mono text-[9.5px] " + (i === activeIndex ? "text-[#FDF8F0]/80" : "text-ink/50")}>
                Tag {pc.day_number}
              </span>
              <span
                className={
                  "my-1 h-[9px] w-[9px] rounded-full " +
                  (i === activeIndex ? "bg-[#FDF8F0]" : pc.is_sea_day ? "bg-ink/14" : "bg-stamp/50")
                }
              />
              <span
                title={pc.is_sea_day ? undefined : pc.port_name}
                className={
                  "line-clamp-2 w-full break-words text-[11px] leading-tight " +
                  (i === activeIndex ? "font-medium text-[#FDF8F0]" : "text-ink/60")
                }
              >
                {pc.is_sea_day ? "Seetag" : pc.port_name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        key={active.id}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-[18px] border border-ink/12 bg-card text-sm text-ink/80"
      >
        {photoUrl ? (
          <div className="relative h-[150px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <div className="absolute left-3 top-3">{stampBadge}</div>
            {photoAttribution && (
              <p className="absolute bottom-1 right-2 font-mono text-[8.5px] text-white/70">Foto: {photoAttribution}</p>
            )}
          </div>
        ) : (
          <div className="pb-1 pl-3 pt-3">{stampBadge}</div>
        )}

        <div className={"p-3 " + (photoUrl ? "" : "pt-1")}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-xl italic text-ink">{active.is_sea_day ? "Seetag" : active.port_name}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Vorheriger Tag"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/12 text-ink/50 hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === portCalls.length - 1}
              aria-label="Nächster Tag"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/12 text-ink/50 hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
        </div>

        {!active.is_sea_day && (
          <>
            {(active.arrival_time || active.departure_time) && (
              <p className="mt-1 font-mono text-xs text-sea">
                {active.arrival_time && <>An {active.arrival_time}</>}
                {active.arrival_time && active.departure_time && " · "}
                {active.departure_time && <>Ab {active.departure_time}</>}
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {excursions
                .filter((e) => e.port_call_id === active.id)
                .map((e) => (
                  <ExcursionCard key={e.id} excursion={e} onDelete={onDeleteExcursion} />
                ))}
            </ul>
            <div className="mt-3">
              <PortResearch
                tripId={tripId}
                portCallId={active.id}
                initialFindings={research.filter((r) => r.port_call_id === active.id)}
                isAdmin={isAdmin}
              />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
