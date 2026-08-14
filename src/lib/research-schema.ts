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

// Kategorien der Hafenrecherche, die NICHT an ein bestimmtes Schiff/Reise
// gebunden sind (Anleger, Sehenswürdigkeiten, Fußweg, Essen, Praktisches,
// Wetter) - diese landen geteilt über alle Reisen hinweg in port_research.
// ausflug_offiziell/ausflug_privat bleiben trip-spezifisch in
// research_findings, da sich Reederei-Ausflugsangebote unterscheiden können.
export const SHARED_PORT_CATEGORIES: ResearchCategory[] = [
  "anleger",
  "zu_fuss",
  "essen",
  "praktisches",
  "sehenswuerdigkeiten",
  "wetter_packen",
  "sonstiges",
];

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
 * Bei mehrabsätzigen content-Feldern setzt das Modell trotz Anweisung
 * gelegentlich einen echten Zeilenumbruch statt "\n" innerhalb eines
 * JSON-Strings - das lässt JSON.parse mit "Bad control character" scheitern,
 * obwohl der Inhalt inhaltlich vollständig und korrekt ist. Escaped daher
 * rohe Steuerzeichen (Zeilenumbruch, Tab, Wagenrücklauf), die INNERHALB
 * eines JSON-Strings auftreten - außerhalb von Strings (Einrückung
 * zwischen den Objekten) bleiben sie unverändert, da dort erlaubt.
 */
function escapeControlCharsInStrings(text: string): string {
  let result = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") {
        result += ch + (text[i + 1] ?? "");
        i += 1;
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
      result += ch;
      continue;
    }
    if (ch === '"') inString = true;
    result += ch;
  }
  return result;
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
    try {
      parsed = JSON.parse(escapeControlCharsInStrings(match[0]));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isResearchFinding);
}
