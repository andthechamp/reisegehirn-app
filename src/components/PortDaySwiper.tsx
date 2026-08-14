"use client";

import { useRef, useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ExcursionCard from "@/components/ExcursionCard";
import PortResearch from "@/components/PortResearch";

type PortCall = TripContext["port_calls"][number];
type Excursion = TripContext["excursions"][number];
type Finding = TripContext["research"][number];

interface PortDaySwiperProps {
  tripId: string;
  portCalls: PortCall[];
  excursions: Excursion[];
  research: Finding[];
  onDeleteExcursion: (id: string) => void;
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
}: PortDaySwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (portCalls.length === 0) {
    return <p className="text-sm text-ink/50">Noch kein Reiseverlauf hinterlegt.</p>;
  }

  const active = portCalls[activeIndex];
  const goTo = (i: number) => setActiveIndex(Math.max(0, Math.min(portCalls.length - 1, i)));

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
    <div className="space-y-3">
      <div className="flex w-full overflow-x-auto pb-1">
        <div className="flex w-max gap-1.5">
          {portCalls.map((pc, i) => (
            <button
              key={pc.id}
              onClick={() => goTo(i)}
              className={
                "flex w-20 shrink-0 flex-col items-center rounded-lg px-1 py-1.5 text-center transition " +
                (i === activeIndex ? "bg-fjord-light" : "hover:bg-mist")
              }
            >
              <span className="text-[10px] text-ink/50">Tag {pc.day_number}</span>
              <span
                className={
                  "my-1 h-2.5 w-2.5 rounded-full " +
                  (i === activeIndex ? "bg-fjord" : pc.is_sea_day ? "bg-ink/15" : "bg-fjord/30")
                }
              />
              <span
                title={pc.is_sea_day ? undefined : pc.port_name}
                className={
                  "line-clamp-2 w-full break-words text-[11px] leading-tight " +
                  (i === activeIndex ? "font-medium text-fjord-dark" : "text-ink/60")
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
        className="rounded-lg border border-ink/10 p-3 text-sm text-ink/80"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">
            Tag {active.day_number} ({active.call_date}): {active.is_sea_day ? "Seetag" : active.port_name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Vorheriger Tag"
              className="rounded-full p-1 text-ink/40 hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === portCalls.length - 1}
              aria-label="Nächster Tag"
              className="rounded-full p-1 text-ink/40 hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
        </div>

        {!active.is_sea_day && (
          <>
            {(active.arrival_time || active.departure_time) && (
              <p className="mt-1 text-xs text-ink/60">
                {active.arrival_time && <>An: {active.arrival_time}</>}
                {active.arrival_time && active.departure_time && ", "}
                {active.departure_time && <>Ab: {active.departure_time}</>}
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {excursions
                .filter((e) => e.port_call_id === active.id)
                .map((e) => (
                  <ExcursionCard key={e.id} excursion={e} onDelete={onDeleteExcursion} />
                ))}
            </ul>
            <PortResearch
              tripId={tripId}
              portCallId={active.id}
              initialFindings={research.filter((r) => r.port_call_id === active.id)}
            />
          </>
        )}
      </div>
    </div>
  );
}
