"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";
import { SpinnerIcon, InfoIcon, ChevronRightIcon } from "@/components/icons";

type Finding = TripContext["research"][number];

const CATEGORY_LABEL: Record<string, string> = {
  insider_tipps: "Gästestimmen & Insider-Tipps",
};

interface ShipResearchProps {
  tripId: string;
  initialFindings: Finding[];
  // Der Recherche-Trigger ist admin-only (siehe /api/research/ship). Seit
  // RESEARCH_AUTO = false (lib/anthropic.ts) ist er der einzige Weg, der
  // überhaupt noch einen Recherche-Lauf startet - fehlende Themen werden
  // sonst nur als Lücke protokolliert und redaktionell gefüllt.
  isAdmin: boolean;
  // Anzahl Bord-ABC-Themen (eigener Screen statt Cards in dieser Liste, siehe
  // BordAbc.tsx - 36 Nachschlage-Themen würden die Schiffswissen-/
  // Insider-Tipps-Cards sonst überfluten). undefined/0 blendet den
  // Einstiegspunkt aus.
  bordAbcCount?: number;
  onOpenBordAbc?: () => void;
}

export default function ShipResearch({
  tripId,
  initialFindings,
  isAdmin,
  bordAbcCount = 0,
  onOpenBordAbc,
}: ShipResearchProps) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    // "Erneut recherchieren" (findings bereits vorhanden) erzwingt eine neue
    // Websuche; der erste Klick ohne vorhandene Daten nutzt zuerst den Cache
    // einer anderen Reise auf demselben Schiff, falls vorhanden.
    const force = findings.length > 0;
    try {
      const res = await fetch("/api/research/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Recherche fehlgeschlagen.");
      if (json.findings.length === 0) {
        setError("Es konnten keine verlässlichen Informationen gefunden werden.");
      } else {
        // Ersetzt die bisherige Liste, da die API alte Schiffsinfos vor dem
        // Einfügen neuer Ergebnisse bereits serverseitig gelöscht hat.
        setFindings(json.findings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-medium text-ink">Schiffsinfos</h2>
        {isAdmin && (
          <button
            onClick={handleResearch}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm font-medium text-stamp hover:text-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading && <SpinnerIcon className="h-3.5 w-3.5" />}
            {loading ? "Recherchiert …" : findings.length > 0 ? "Erneut recherchieren" : "Jetzt recherchieren"}
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {findings.length === 0 && !loading && (
        <p className="text-sm text-ink/50">
          {isAdmin
            ? "Noch keine Infos zu diesem Schiff recherchiert (Decksplan, Restaurants, Bordprogramm, Ausstattung, Gästestimmen & Insider-Tipps)."
            : "Für dieses Schiff sind noch keine Infos hinterlegt (Decksplan, Restaurants, Bordprogramm, Ausstattung, Gästestimmen & Insider-Tipps)."}
        </p>
      )}

      <div className="space-y-2">
        {findings.map((f) => (
          <ResearchCard
            key={f.id}
            finding={f}
            categoryLabel={CATEGORY_LABEL[f.category] ?? null}
            categoryTone="amber"
          />
        ))}

        {bordAbcCount > 0 && onOpenBordAbc && (
          <button
            onClick={onOpenBordAbc}
            className="flex w-full items-center gap-3 rounded-r-[14px] border-l-[3px] border-stamp bg-card py-3 pl-3 pr-3 text-left shadow-sm"
          >
            <InfoIcon className="h-4 w-4 shrink-0 text-stamp" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
              Bord-ABC <span className="font-normal text-ink/50">· {bordAbcCount} Themen</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink/30" />
          </button>
        )}
      </div>
    </section>
  );
}
