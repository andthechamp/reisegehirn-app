// Spiegelt die Spalten der research_findings-Tabelle aus supabase/schema.sql
// (Ebene 2 "Recherchiertes Wissen").

export type ResearchCategory =
  | "anleger"
  | "ausflug_offiziell"
  | "ausflug_privat"
  | "zu_fuss"
  | "essen"
  | "praktisches"
  | "sehenswuerdigkeiten"
  | "schiffswissen"
  | "insider_tipps"
  | "wetter_packen"
  | "sonstiges";

export type SourceTier = "A" | "B" | "C";
export type Staleness = "zeitlos" | "saisonal" | "verfällt";

export interface ResearchFinding {
  category: ResearchCategory;
  title: string;
  content: string;
  source_tier: SourceTier;
  source_name: string | null;
  source_url: string | null;
  staleness: Staleness;
}

const VALID_CATEGORIES: ResearchCategory[] = [
  "anleger",
  "ausflug_offiziell",
  "ausflug_privat",
  "zu_fuss",
  "essen",
  "praktisches",
  "sehenswuerdigkeiten",
  "schiffswissen",
  "insider_tipps",
  "wetter_packen",
  "sonstiges",
];
const VALID_SOURCE_TIERS: SourceTier[] = ["A", "B", "C"];
const VALID_STALENESS: Staleness[] = ["zeitlos", "saisonal", "verfällt"];

function isResearchFinding(item: unknown): item is ResearchFinding {
  if (typeof item !== "object" || item === null) return false;
  const f = item as Record<string, unknown>;
  return (
    typeof f.title === "string" &&
    typeof f.content === "string" &&
    VALID_CATEGORIES.includes(f.category as ResearchCategory) &&
    VALID_SOURCE_TIERS.includes(f.source_tier as SourceTier) &&
    VALID_STALENESS.includes(f.staleness as Staleness) &&
    (f.source_name === null || typeof f.source_name === "string") &&
    (f.source_url === null || typeof f.source_url === "string")
  );
}

/**
 * Claudes Antwort mischt bei Websuche-Tool-Nutzung Freitext/Zitationen mit dem
 * am Ende angeforderten JSON-Array. Wir extrahieren das erste vollständige
 * JSON-Array aus dem Text, statt den ganzen Text als JSON zu parsen.
 * Liefert bewusst [] statt einen Fehler zu werfen - Recherche ist ein
 * unterstützendes Feature, kein kritischer Pfad wie die Extraktion.
 */
export function parseResearchFindings(raw: string): ResearchFinding[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isResearchFinding);
}
