"use client";

import { useMemo, useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";
import { ChevronLeftIcon } from "@/components/icons";

type Finding = TripContext["research"][number];

interface BordAbcProps {
  findings: Finding[];
  onBack: () => void;
}

// Nachschlage-Content (36 Bordregeln, flottenweit identisch außer
// Notfalltelefon) statt Entdecke-Content wie Restaurants/Deckplan - deshalb
// eigener Screen mit Suchfeld statt Cards in der Schiffsinfos-Liste (siehe
// ShipResearch.tsx). Titel *und* Inhalt werden durchsucht, damit z. B. die
// Suche nach "Messer" auch "Verbotene Gegenstände" findet, obwohl "Messer"
// nicht im Titel steht.
export default function BordAbc({ findings, onBack }: BordAbcProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return findings;
    return findings.filter((f) => f.title.toLowerCase().includes(q) || f.content.toLowerCase().includes(q));
  }, [findings, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/60 hover:text-ink"
          aria-label="Zurück zur Reise"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-medium text-ink">Bord-ABC</h2>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Suchen, z. B. „Notfall“ oder „Dresscode“ …"
        className="w-full rounded-lg border border-logbook/15 bg-card px-4 py-2.5 text-[15px] text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-stamp/40"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-ink/50">Keine Treffer für „{query}“.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <ResearchCard key={f.id} finding={f} categoryTone="amber" />
          ))}
        </div>
      )}
    </section>
  );
}
