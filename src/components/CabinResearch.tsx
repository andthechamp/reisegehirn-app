"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";
import { SpinnerIcon } from "@/components/icons";

type Finding = TripContext["research"][number];

const CATEGORY_LABEL: Record<string, string> = {
  insider_tipps: "Gästestimmen & Insider-Tipps",
};

interface CabinGroup {
  label: string; // Cache-/API-Schlüssel: Kategorie oder "Kategorie · Deck N" (siehe cabinLabel() in lib/cabin.ts)
  category: string; // reine Kategorie, für die Anzeige, z. B. "Balkonkabine Kategorie D"
  deck: string | null;
  cabinNumbers: string[];
}

interface CabinResearchProps {
  tripId: string;
  groups: CabinGroup[];
  initialFindings: Finding[]; // alle Findings mit gesetztem cabin_category
  // Der Recherche-Trigger ist admin-only (siehe /api/research/cabin). Seit
  // RESEARCH_AUTO = false (lib/anthropic.ts) ist er der einzige Weg, der
  // überhaupt noch einen Recherche-Lauf startet - fehlende Themen werden
  // sonst nur als Lücke protokolliert und redaktionell gefüllt.
  isAdmin: boolean;
}

export default function CabinResearch({ tripId, groups, initialFindings, isAdmin }: CabinResearchProps) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResearch(label: string) {
    setLoadingCategory(label);
    setError(null);
    const existing = findings.filter((f) => f.cabin_category === label);
    const force = existing.length > 0;
    try {
      const res = await fetch("/api/research/cabin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, cabin_category: label, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Recherche fehlgeschlagen.");
      if (json.findings.length === 0) {
        setError(`Zu "${label}" konnten keine verlässlichen Informationen gefunden werden.`);
      } else {
        setFindings((prev) => [
          ...prev.filter((f) => f.cabin_category !== label),
          ...(json.findings as Array<Record<string, unknown>>).map((r) => ({
            id: r.id as string,
            port_call_id: null,
            cabin_category: (r.cabin_category as string | null) ?? label,
            category: r.category as string,
            title: r.title as string,
            content: r.content as string,
            items: null,
            source_tier: r.source_tier as string,
            source_name: (r.source_name as string | null) ?? null,
            source_url: (r.source_url as string | null) ?? null,
            staleness: r.staleness as string,
            shared: true,
          })),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoadingCategory(null);
    }
  }

  if (groups.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-medium text-ink">Deine Kabine(n)</h2>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {groups.map((g) => {
        const groupFindings = findings.filter((f) => f.cabin_category === g.label);
        const loading = loadingCategory === g.label;
        return (
          <div key={g.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink/80">
                {g.category}
                {g.deck && <span className="text-ink/40"> · Deck {g.deck}</span>}
                {g.cabinNumbers.length > 0 && (
                  <span className="text-ink/40"> · Kabine {g.cabinNumbers.join(", ")}</span>
                )}
              </p>
              {isAdmin && (
                <button
                  onClick={() => handleResearch(g.label)}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-sm font-medium text-stamp hover:text-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading && <SpinnerIcon className="h-3.5 w-3.5" />}
                  {loading ? "Recherchiert …" : groupFindings.length > 0 ? "Erneut recherchieren" : "Jetzt recherchieren"}
                </button>
              )}
            </div>

            {groupFindings.length === 0 && !loading && (
              <p className="text-sm text-ink/50">
                {isAdmin
                  ? "Noch keine Infos zu dieser Kabinenkategorie recherchiert (Größe, Ausstattung, Lage)."
                  : "Für diese Kabinenkategorie sind noch keine Infos hinterlegt (Größe, Ausstattung, Lage)."}
              </p>
            )}

            <div className="space-y-2">
              {groupFindings.map((f) => (
                <ResearchCard
                  key={f.id}
                  finding={f}
                  categoryLabel={CATEGORY_LABEL[f.category] ?? null}
                  categoryTone="amber"
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}


export type { CabinGroup };
