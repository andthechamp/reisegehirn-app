"use client";

import type { TripContext } from "@/lib/trip-context";
import { PlaneIcon, CarIcon } from "@/components/icons";

type Transfer = TripContext["transfers"][number];

// Postgres liefert "time"-Spalten als HH:MM:SS zurück - für die Anzeige
// reichen HH:MM, analog zu meeting_time bei Ausflügen.
function trimSeconds(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

export default function TransferCard({
  transfer: t,
  onDelete,
}: {
  transfer: Transfer;
  onDelete: (id: string) => void;
}) {
  const isFlug = t.transfer_art === "flug";
  const isAnreise = t.direction === "anreise";
  const Icon = isFlug ? PlaneIcon : CarIcon;

  return (
    <li
      className={
        "rounded-r-[14px] border-l-[3px] bg-card p-3 text-sm " + (isFlug ? "border-sea" : "border-stamp")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <p className="text-[15.5px] font-semibold text-ink">
                {isAnreise ? "Anreise" : "Abreise"}
                {isFlug && t.flugnummer && <> · {t.flugnummer}</>}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[.1em] text-ink/45">
                {isFlug ? "Flug" : "Auto"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs leading-[1.55] text-ink/65">
              {t.date && <>{t.date}</>}
              {isFlug && (
                <>
                  {t.date && (t.abflugzeit || t.ankunftszeit) && " · "}
                  {t.abflugzeit && <>Abflug {trimSeconds(t.abflugzeit)}</>}
                  {t.abflugzeit && t.ankunftszeit && " · "}
                  {t.ankunftszeit && <>Ankunft {trimSeconds(t.ankunftszeit)}</>}
                  {t.airline && <> · {t.airline}</>}
                </>
              )}
              {!isFlug && t.parkplatz_anbieter && (
                <>
                  {t.date && " · "}
                  {t.parkplatz_anbieter}
                </>
              )}
              {t.reservierungsnummer && <> · Ref. {t.reservierungsnummer}</>}
            </p>
            {!isFlug && t.parkplatz_buchungslink && (
              <a
                href={t.parkplatz_buchungslink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-xs text-sea hover:underline"
              >
                {t.parkplatz_buchungslink}
              </a>
            )}
            {t.notes && <p className="mt-1 text-xs text-ink/70">{t.notes}</p>}
          </div>
        </div>
        <button onClick={() => onDelete(t.id)} className="shrink-0 text-xs text-ink/40 hover:text-red-700">
          Entfernen
        </button>
      </div>
    </li>
  );
}
