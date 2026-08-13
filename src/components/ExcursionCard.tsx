"use client";

import type { TripContext } from "@/lib/trip-context";

type Excursion = TripContext["excursions"][number];

export default function ExcursionCard({ excursion: e, onDelete }: { excursion: Excursion; onDelete: (id: string) => void }) {
  return (
    <li className="rounded-lg bg-amber-light/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">
            {e.title}{" "}
            <span className="text-xs font-normal text-ink/50">
              ({e.provider_type === "reederei" ? "Reederei" : "privat"})
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink/70">
            {e.meeting_point && <>Treffpunkt: {e.meeting_point} · </>}
            {e.meeting_time && <>Uhrzeit: {e.meeting_time}</>}
          </p>
          {e.price_total != null && (
            <p className="text-xs text-ink/70">
              Preis: {e.price_total} {e.currency ?? "EUR"}
            </p>
          )}
          {e.booking_reference && <p className="text-xs text-ink/70">Buchungsnummer: {e.booking_reference}</p>}
          {e.notes && <p className="mt-1 text-xs text-ink/70">{e.notes}</p>}
        </div>
        <button onClick={() => onDelete(e.id)} className="shrink-0 text-xs text-ink/40 hover:text-red-700">
          Entfernen
        </button>
      </div>
    </li>
  );
}
