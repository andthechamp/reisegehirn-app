"use client";

import type { TripContext } from "@/lib/trip-context";

type Excursion = TripContext["excursions"][number];

export default function ExcursionCard({
  excursion: e,
  onDelete,
  dayLabel,
}: {
  excursion: Excursion;
  onDelete: (id: string) => void;
  dayLabel?: string;
}) {
  const isReederei = e.provider_type === "reederei";

  return (
    <li
      className={
        "rounded-r-[14px] border-l-[3px] bg-card p-3 text-sm " + (isReederei ? "border-stamp" : "border-sea")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {dayLabel && (
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-ink/45">{dayLabel}</p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-[15.5px] font-semibold text-ink">{e.title}</p>
            <span className="font-mono text-[10px] uppercase tracking-[.1em] text-ink/45">
              {isReederei ? "Reederei" : "Privat"}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs leading-[1.55] text-ink/65">
            {e.meeting_time && <>{e.meeting_time}</>}
            {e.meeting_time && e.meeting_point && " · "}
            {e.meeting_point && <>{e.meeting_point}</>}
            {e.price_total != null && (
              <>
                {" "}
                · {e.price_total} {e.currency ?? "EUR"}
              </>
            )}
            {e.booking_reference && <> · Buchung {e.booking_reference}</>}
          </p>
          {e.notes && <p className="mt-1 text-xs text-ink/70">{e.notes}</p>}
        </div>
        <button onClick={() => onDelete(e.id)} className="shrink-0 text-xs text-ink/40 hover:text-red-700">
          Entfernen
        </button>
      </div>
    </li>
  );
}
