"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";
import { SpinnerIcon } from "@/components/icons";

type Finding = TripContext["research"][number];

const CATEGORY_LABEL: Record<string, string> = {
  insider_tipps: "Gästestimmen & Insider-Tipps",
};

interface ShipResearchProps {
  tripId: string;
  initialFindings: Finding[];
  // Der manuelle Trigger ist admin-only (siehe /api/research/ship) - für
  // alle anderen Nutzer:innen läuft Recherche automatisch beim Laden der
  // Reise im Hintergrund (siehe ensureShipResearched).
  isAdmin: boolean;
}

export default function ShipResearch({ tripId, initialFindings, isAdmin }: ShipResearchProps) {
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
            : "Infos zu diesem Schiff werden im Hintergrund recherchiert (Decksplan, Restaurants, Bordprogramm, Ausstattung, Gästestimmen & Insider-Tipps) - bitte gleich noch einmal vorbeischauen."}
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
      </div>
    </section>
  );
}
