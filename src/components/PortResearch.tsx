"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";

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
};

interface PortResearchProps {
  tripId: string;
  portCallId: string;
  initialFindings: Finding[];
}

export default function PortResearch({ tripId, portCallId, initialFindings }: PortResearchProps) {
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
    try {
      const res = await fetch("/api/research/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, port_call_id: portCallId }),
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleResearch}
          disabled={loading}
          className="text-xs font-medium text-fjord hover:text-fjord-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Recherchiert …" : findings.length > 0 ? "Erneut recherchieren" : "Hafen recherchieren"}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}

      {findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f) => (
            <ResearchCard
              key={f.id}
              finding={f}
              categoryLabel={CATEGORY_LABEL[f.category] ?? f.category}
              categoryTone="fjord"
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
