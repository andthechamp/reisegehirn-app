"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";
import { SpinnerIcon } from "@/components/icons";

type Finding = TripContext["research"][number];

const CATEGORY_LABEL: Record<string, string> = {
  sehenswuerdigkeiten: "Top 5 Sehenswürdigkeiten",
  anleger: "Anleger",
  ausflug_offiziell: "Ausflug (Reederei)",
  ausflug_privat: "Ausflug (privat)",
  zu_fuss: "Zu Fuß erreichbar",
  essen: "Essen",
  praktisches: "Praktisches",
  wetter_packen: "Wetter & Packen",
  sonstiges: "Sonstiges",
  insider_tipps: "Insider-Tipps",
};

// Feste Lesereihenfolge statt der bisherigen sort_order (die je Hafen von der
// zufälligen Antwortreihenfolge der KI-Websuche abhing und daher zwischen
// Häfen inkonsistent war): erst Orientierung/Ankunft (Anleger,
// Sehenswürdigkeiten, zu Fuß erreichbar), dann Ausflüge, dann Essen/
// Praktisches/Wetter, zuletzt Insider-Tipps/Sonstiges. Innerhalb einer
// Kategorie bleibt die bisherige sort_order maßgeblich (stabiler Sort).
const CATEGORY_ORDER: string[] = [
  "anleger",
  "sehenswuerdigkeiten",
  "zu_fuss",
  "ausflug_offiziell",
  "ausflug_privat",
  "essen",
  "praktisches",
  "wetter_packen",
  "insider_tipps",
  "sonstiges",
];

function sortByCategory(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const rankA = CATEGORY_ORDER.indexOf(a.category);
    const rankB = CATEGORY_ORDER.indexOf(b.category);
    return (rankA === -1 ? CATEGORY_ORDER.length : rankA) - (rankB === -1 ? CATEGORY_ORDER.length : rankB);
  });
}

interface PortResearchProps {
  tripId: string;
  portCallId: string;
  initialFindings: Finding[];
  // Der Recherche-Trigger ist admin-only (siehe /api/research/port). Seit
  // RESEARCH_AUTO = false (lib/anthropic.ts) ist er der einzige Weg, der
  // überhaupt noch einen Recherche-Lauf startet - fehlende Themen werden
  // sonst nur als Lücke protokolliert und redaktionell gefüllt.
  isAdmin: boolean;
}

export default function PortResearch({ tripId, portCallId, initialFindings, isAdmin }: PortResearchProps) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/research/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Löschen fehlgeschlagen.");
      setFindings((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    }
  }

  async function handleResearch() {
    setLoading(true);
    setError(null);
    // "Erneut recherchieren" (Ergebnisse bereits vorhanden) erzwingt eine neue
    // Websuche; der erste Klick nutzt zuerst den Cache, falls eine andere
    // Reise diesen Hafen bereits recherchiert hat.
    const force = findings.length > 0;
    try {
      const res = await fetch("/api/research/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, port_call_id: portCallId, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Recherche fehlgeschlagen.");
      if (json.findings.length === 0) {
        setError("Es konnten keine verlässlichen Informationen gefunden werden.");
      } else {
        setFindings(json.findings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleResearch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-sea hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading && <SpinnerIcon className="h-3 w-3" />}
            {loading ? "Recherchiert …" : findings.length > 0 ? "Erneut recherchieren" : "Hafen recherchieren"}
          </button>
        </div>
      )}

      {!isAdmin && findings.length === 0 && (
        <p className="text-xs text-ink/50">
          Für diesen Hafen sind noch keine Infos hinterlegt.
        </p>
      )}

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}

      {findings.length > 0 && (
        <div className="space-y-2 lg:space-y-3">
          {sortByCategory(findings).map((f) => (
            <div key={f.id}>
              <ResearchCard
                finding={f}
                categoryLabel={CATEGORY_LABEL[f.category] ?? f.category}
                categoryTone="fjord"
                // Geteiltes Hafenwissen (port_research) ist nicht pro Reise
                // löschbar, da das alle Reisen beträfe, die denselben Hafen
                // nutzen - analog zu Schiffsinfos in ShipResearch. Nur
                // trip-spezifische Ausflüge lassen sich entfernen.
                onDelete={f.shared ? undefined : handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
