// Spiegelt die Spalten der research_findings-Tabelle aus supabase/schema.sql
// (Ebene 2 "Recherchiertes Wissen").

import { isValidWikimediaFileUrl } from "@/lib/wikimedia";

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
export type ImageSource = "wikimedia_commons" | "wikipedia";

// Wie lange ein Fund pro Staleness-Einstufung als aktuell gilt, bevor der
// Cache (ship_research/port_research) für einen erneuten KI-Rechercheversuch
// fällig wird. "zeitlos" (Decksplan, Kabinengrundriss o.ä.) ändert sich
// praktisch nie und muss daher nicht alle paar Tage blind neu recherchiert
// werden; "verfällt" (Preise, Öffnungszeiten) bleibt beim bisherigen
// konservativen 7-Tage-Wert.
export const CACHE_TTL_DAYS_BY_STALENESS: Record<Staleness, number> = {
  zeitlos: 90,
  saisonal: 30,
  verfällt: 7,
};

/**
 * Ein Rechercheergebnis wird als zusammenhängender Satz Zeilen mit fast
 * identischem retrieved_at gespeichert (siehe researchAndSaveShip/-Cabin/
 * -Port) - für die Frage "ist der Cache noch frisch genug?" zählt daher die
 * VOLATILSTE unter den vorhandenen Staleness-Einstufungen: enthält der Satz
 * auch nur eine "verfällt"-Zeile, ist der ganze Satz nach 7 Tagen fällig,
 * selbst wenn andere Zeilen "zeitlos" sind. Ohne Zeilen (noch nie
 * recherchiert) liefert der konservativste Wert, damit ein leerer Cache nie
 * als "lange frisch" fehlinterpretiert wird.
 */
export function computeCacheTtlDays(stalenessValues: Array<string | null | undefined>): number {
  const known = stalenessValues.filter((s): s is Staleness => VALID_STALENESS.includes(s as Staleness));
  if (known.length === 0) return CACHE_TTL_DAYS_BY_STALENESS.verfällt;
  return Math.min(...known.map((s) => CACHE_TTL_DAYS_BY_STALENESS[s]));
}

// Maßgebliche strukturierte Fassung einer einzelnen Sehenswürdigkeit -
// unabhängig vom (nur für Chat/Fließtext gedachten) content-Feld, damit die
// Bild-Anzeige nicht von fragilem Text-Parsing der nummerierten Liste
// abhängt (siehe buildPortResearchPrompt).
export interface SightItem {
  name: string;
  description: string;
  image_url: string | null;
  image_source: ImageSource | null;
  // Link für "Mehr erfahren" - Wikipedia-Artikel falls vorhanden, sonst eine
  // Google-Suche als Fallback (siehe lookupWikipediaImage/googleSearchUrl).
  article_url: string | null;
}

export interface ResearchFinding {
  category: ResearchCategory;
  title: string;
  content: string;
  // Nur bei category "sehenswuerdigkeiten" befüllt (siehe buildPortResearchPrompt).
  items?: SightItem[];
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
const VALID_IMAGE_SOURCES: ImageSource[] = ["wikimedia_commons", "wikipedia"];

function isSightItem(item: unknown): item is SightItem {
  if (typeof item !== "object" || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.name === "string" &&
    typeof i.description === "string" &&
    // image_url/image_source kommen nicht mehr von der KI (die liefert nur
    // noch name+description) - sie werden erst danach serverseitig über
    // lookupWikipediaImage() ergänzt, sind beim Parsen also normalerweise
    // schlicht nicht vorhanden (undefined).
    (i.image_url === undefined || i.image_url === null || typeof i.image_url === "string") &&
    (i.image_source === undefined || i.image_source === null || VALID_IMAGE_SOURCES.includes(i.image_source as ImageSource)) &&
    (i.article_url === undefined || i.article_url === null || typeof i.article_url === "string")
  );
}

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
    (f.source_url === null || typeof f.source_url === "string") &&
    (f.items === undefined || (Array.isArray(f.items) && f.items.every(isSightItem)))
  );
}

/**
 * Findet ab Position `i` (direkt nach einer `"` innerhalb eines Strings) das
 * nächste Nicht-Leerzeichen-Zeichen und meldet, ob es zu den Zeichen gehört,
 * die nach einem echten JSON-String-Ende folgen können (",", "}", "]", ":").
 * Dient dazu, eine echte schließende Anführung von einer Zitat-Anführung
 * MITTEN im Content zu unterscheiden (siehe escapeControlCharsInStrings).
 */
function looksLikeRealStringEnd(text: string, i: number): boolean {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j += 1;
  return j >= text.length || ",}]:".includes(text[j]);
}

/**
 * Reparaturschritt für zwei bekannte Arten, wie Claudes Websuche-Antworten
 * gültiges JSON knapp verfehlen können, obwohl der Inhalt vollständig und
 * korrekt ist:
 *
 * 1. Ein echter Zeilenumbruch statt "\n" innerhalb eines JSON-Strings -
 *    lässt JSON.parse mit "Bad control character" scheitern.
 * 2. Ein wörtliches Zitat im content-Feld, bei dem das Modell eine deutsche
 *    öffnende Anführung („) mit einer geraden ASCII-Anführung (") statt der
 *    passenden schließenden schließt (z. B. „Insel der Seeräuber" statt
 *    „Insel der Seeräuber") - diese unescapte " mitten im String beendet
 *    für JSON.parse den String vorzeitig. Erkannt primär über ein offenes „,
 *    das noch nicht durch " geschlossen wurde: folgt danach eine gerade "
 *    ohne dass zwischendurch " kam, ist das fast sicher die gemeinte
 *    schließende Anführung, unabhängig davon, was danach folgt (z. B. direkt
 *    ein Komma, wie bei „Meine Landausflüge.de", die ...). Ohne offenes „
 *    bleibt als Fallback der Blick auf das nächste Nicht-Leerzeichen-Zeichen:
 *    folgt kein JSON-Strukturzeichen (",", "}", "]", ":"), war es keine
 *    echte schließende Anführung.
 *
 * Außerhalb von Strings (Einrückung zwischen den Objekten) bleibt der Text
 * unverändert, da dort erlaubt/irrelevant.
 */
function escapeControlCharsInStrings(text: string): string {
  let result = "";
  let inString = false;
  let openGermanQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") {
        result += ch + (text[i + 1] ?? "");
        i += 1;
        continue;
      }
      if (ch === "„") {
        openGermanQuote = true;
        result += ch;
        continue;
      }
      if (ch === '"') {
        if (openGermanQuote) {
          // Schließt eine zuvor geöffnete „...“-Phrase innerhalb des
          // content-Feldes - das ist NIE das echte Ende des JSON-Strings,
          // selbst wenn direkt danach zufällig ein Komma folgt (siehe
          // „Meine Landausflüge.de", die ... im Beispiel oben).
          openGermanQuote = false;
          result += '\\"';
        } else if (looksLikeRealStringEnd(text, i + 1)) {
          inString = false;
          result += ch;
        } else {
          result += '\\"';
        }
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
    if (ch === '"') {
      inString = true;
      openGermanQuote = false;
    }
    result += ch;
  }
  return result;
}

/**
 * Bei Websuche-Tool-Nutzung markiert Claude wörtliche Übernahmen aus
 * Suchergebnissen gelegentlich mit <cite index="12-3,12-4">...</cite> direkt
 * im content-Feld. Das ist reines Zitat-Markup, kein für Nutzer:innen
 * relevanter Inhalt - wir entfernen die Tags und behalten den zitierten Text.
 * Läuft VOR dem JSON-Parsing, weil die Anführung im index-Attribut sonst ein
 * JSON-String vorzeitig beenden kann (siehe escapeControlCharsInStrings).
 */
function stripCitationTags(text: string): string {
  return text.replace(/<\/?cite(?:[^<>]*)>/g, "");
}

/**
 * Das Modell hält sich nicht immer an die Prompt-Vorgabe, image_url nur bei
 * einer echten Datei-Seite mit klarer Lizenz zu setzen - z. B. liefert es
 * gelegentlich einen Commons-Kategorie-Link mit mehreren Bildern unklarer
 * Lizenz statt eines einzelnen Bildes (beobachtet bei Bergen: "Category:
 * Bergen_Fishmarket" statt "File:..."). Statt dem selbstberichteten
 * image_source zu vertrauen, wird die URL serverseitig geprüft und bei
 * ungültiger Form auf null gesetzt, BEVOR sie in port_research landet.
 */
function sanitizeSightItems(items: SightItem[]): SightItem[] {
  return items.map((item) =>
    item.image_url && !isValidWikimediaFileUrl(item.image_url)
      ? { ...item, image_url: null, image_source: null }
      : item
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
  const cleaned = stripCitationTags(raw);
  const match = cleaned.match(/\[[\s\S]*\]/);
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
  return parsed.filter(isResearchFinding).map((f) => (f.items ? { ...f, items: sanitizeSightItems(f.items) } : f));
}
