import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildTripLiegezeitenExtractionPrompt } from "@/lib/prompts";
import { escapeControlCharsInStrings, stripCitationTags } from "@/lib/research-schema";

interface BerthTimeEntry {
  call_date: string;
  port_name: string;
  arrival_time: string | null;
  departure_time: string | null;
  source_tier: string | null;
  source_name: string | null;
  source_url: string | null;
  tier_note: string | null;
}

function isBerthTimeEntry(v: unknown): v is BerthTimeEntry {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.call_date === "string" &&
    typeof r.port_name === "string" &&
    (r.arrival_time === null || typeof r.arrival_time === "string") &&
    (r.departure_time === null || typeof r.departure_time === "string")
  );
}

/**
 * Extrahiert das erste vollständige JSON-Array aus der Modellantwort -
 * gleiche Reparaturstrategie wie parseResearchFindings (research-schema.ts).
 */
function parseTripBerthTimes(raw: string): BerthTimeEntry[] {
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
  return parsed.filter(isBerthTimeEntry);
}

/**
 * Ordnet einen recherchierten Eintrag dem passenden Hafenanlauf zu - zuerst
 * per exaktem Datum, bei mehreren Anläufen am selben Tag (z. B. zwei
 * Fjord-Stopps) zusätzlich per Hafenname als Tiebreaker.
 */
function matchPortCall(portCalls: TripPortCall[], callDate: string, portName: string): TripPortCall | undefined {
  const sameDate = portCalls.filter((pc) => pc.callDate === callDate);
  if (sameDate.length <= 1) return sameDate[0];

  const needle = portName.trim().toLowerCase();
  return (
    sameDate.find((pc) => pc.portName.toLowerCase().includes(needle) || needle.includes(pc.portName.toLowerCase())) ??
    sameDate[0]
  );
}

function formatDateGerman(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
}

/**
 * Gezielte Google-Suche über serper.dev statt Claudes agentischem
 * web_search-Tool - liefert eine fertige, sortierte Ergebnisliste in einem
 * einzigen, schnellen Aufruf statt eines unvorhersagbar langen
 * Tool-Use-Zyklus (siehe buildTripLiegezeitenExtractionPrompt-Kommentar für
 * die Vorgeschichte).
 */
async function searchViaSerper(query: string): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error("Liegezeit-Recherche: SERPER_API_KEY fehlt.");
    return [];
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) {
      console.error(`Liegezeit-Recherche: Serper-Suche fehlgeschlagen (${res.status}).`);
      return [];
    }
    const json = (await res.json()) as { organic?: SerperResult[] };
    return json.organic ?? [];
  } catch (err) {
    console.error("Liegezeit-Recherche: Serper-Suche fehlgeschlagen:", err);
    return [];
  }
}

/**
 * Ruft eine gefundene Fahrplanseite über firecrawl.dev als sauberen
 * Markdown-Text ab - übernimmt JS-Rendering/Anti-Bot-Maßnahmen, die ein
 * einfacher fetch() nicht zuverlässig schafft. Gibt null zurück, wenn die
 * Seite nicht abrufbar ist, statt einen Fehler zu werfen - Recherche ist
 * unterstützend, kein kritischer Pfad.
 */
async function scrapeViaFirecrawl(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("Liegezeit-Recherche: FIRECRAWL_API_KEY fehlt.");
    return null;
  }

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: [{ type: "markdown" }], onlyMainContent: true }),
    });
    if (!res.ok) {
      console.error(`Liegezeit-Recherche: Firecrawl-Abruf fehlgeschlagen (${res.status}) für ${url}.`);
      return null;
    }
    const json = (await res.json()) as { success?: boolean; data?: { markdown?: string } };
    return json.data?.markdown ?? null;
  } catch (err) {
    console.error(`Liegezeit-Recherche: Firecrawl-Abruf fehlgeschlagen für ${url}:`, err);
    return null;
  }
}

// Domains, die erfahrungsgemäß eine strukturierte Reiseverlauf-Tabelle für
// eine konkrete Kreuzfahrt führen (siehe TIER_SYSTEM_RULE-Kommentar in
// prompts.ts) - Kandidaten von dort werden bevorzugt vor sonstigen
// Suchtreffern, auch wenn sie in der Trefferliste weiter unten stehen.
const PREFERRED_DOMAINS = [
  "kreuzfahrtberater.de",
  "kreuzfahrt-ticket.de",
  "kreuzfahrt-erlebnis.de",
  "hafeninfo.de",
  "meinschiff.com",
  "tuicruises.com",
];

function sortByPreferredDomain(results: SerperResult[]): SerperResult[] {
  return [...results].sort((a, b) => {
    const rankA = PREFERRED_DOMAINS.findIndex((d) => a.link.includes(d));
    const rankB = PREFERRED_DOMAINS.findIndex((d) => b.link.includes(d));
    return (rankA === -1 ? PREFERRED_DOMAINS.length : rankA) - (rankB === -1 ? PREFERRED_DOMAINS.length : rankB);
  });
}

export interface TripPortCall {
  id: string;
  portName: string;
  callDate: string;
  arrivalTime: string | null;
  departureTime: string | null;
  confidence: string;
}

export type TripBerthTimeResult =
  | { ok: true; updatedCount: number }
  | { ok: false; error: string };

/**
 * Recherchiert die geplanten Liegezeiten für ALLE noch offenen Hafenanläufe
 * einer Reise in EINEM Durchlauf: gezielte Google-Suche (Serper) nach der
 * passenden Fahrplanseite, Abruf dieser Seite (Firecrawl), anschließend ein
 * einzelner, nicht-agentischer Claude-Extraktionsaufruf auf den bereits
 * vorliegenden Seiteninhalt. Läuft automatisch direkt nach dem Hochladen
 * einer Buchungsbestätigung (siehe /api/confirm), nicht per Klick.
 *
 * Überschreibt NIE eine bereits aus Buchungsunterlagen bestätigte Zeit
 * (confidence 'bestätigt'). Vorhandene einzelne Zeiten (z. B. nur
 * arrival_time gesetzt) bleiben erhalten, wenn die Recherche dafür nichts
 * Neues liefert. Findet sich keine brauchbare Quelle, bleibt die Zeit wie
 * bisher 'unbekannt' - es gibt bewusst KEINEN Fallback auf die frühere
 * agentische Websuche (siehe Git-Historie: unvorhersagbare Laufzeit/Kosten).
 */
export async function researchTripBerthTimes(
  supabase: SupabaseClient,
  params: { shipName: string; portCalls: TripPortCall[] }
): Promise<TripBerthTimeResult> {
  const { shipName, portCalls } = params;

  const missing = portCalls.filter((pc) => pc.confidence !== "bestätigt");
  if (missing.length === 0) return { ok: true, updatedCount: 0 };

  const firstDate = formatDateGerman(missing[0].callDate);

  // Zwei Suchanfragen: erst gezielt auf die bekanntermaßen strukturierten
  // Portale eingeschränkt, dann - falls das nichts liefert - offener. Beide
  // zusammen kosten bei serper.dev Bruchteile eines Cents, deutlich billiger
  // als ein einzelner Claude-Websuche-Aufruf.
  const [narrowResults, broadResults] = await Promise.all([
    searchViaSerper(`site:kreuzfahrtberater.de OR site:kreuzfahrt-ticket.de "${shipName}" ${firstDate}`),
    searchViaSerper(`"${shipName}" Reiseverlauf ${firstDate}`),
  ]);

  const seen = new Set<string>();
  const candidates = sortByPreferredDomain([...narrowResults, ...broadResults]).filter((r) => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });

  if (candidates.length === 0) {
    return { ok: true, updatedCount: 0 };
  }

  // Bis zu 3 Kandidaten durchprobieren, bis einer erfolgreich abrufbar ist
  // und eine zu Schiff/Zeitraum passende Antwort liefert - Firecrawl schlägt
  // gelegentlich bei einzelnen Seiten fehl (Login-Wall, 404 trotz Google-
  // Index, o. Ä.), das soll den ganzen Lauf nicht scheitern lassen.
  for (const candidate of candidates.slice(0, 3)) {
    const pageContent = await scrapeViaFirecrawl(candidate.link);
    if (!pageContent) continue;

    const response = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 4000,
      system: buildTripLiegezeitenExtractionPrompt(
        shipName,
        missing.map((pc) => ({ portName: pc.portName, callDate: pc.callDate })),
        candidate.link,
        pageContent.slice(0, 10000)
      ),
      messages: [
        {
          role: "user",
          content: `Extrahiere die Liegezeiten von "${shipName}" für die oben gelisteten Hafenanläufe aus dem Seiteninhalt.`,
        },
      ],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (response.stop_reason === "max_tokens") {
      console.error(`Liegezeit-Recherche (${shipName}): Antwort durch max_tokens abgeschnitten.\nRohtext:\n`, rawText);
      continue;
    }

    const entries = parseTripBerthTimes(rawText);
    if (entries.length === 0) continue;

    let updatedCount = 0;
    for (const entry of entries) {
      const portCall = matchPortCall(missing, entry.call_date, entry.port_name);
      if (!portCall) continue;
      if (!entry.arrival_time && !entry.departure_time) continue;

      const nextArrivalTime = entry.arrival_time ?? portCall.arrivalTime;
      const nextDepartureTime = entry.departure_time ?? portCall.departureTime;
      const source = entry.source_name
        ? `Websuche: ${entry.source_name}${entry.tier_note ? ` (${entry.tier_note})` : ""}`
        : `Websuche: ${candidate.link}`;

      const { error } = await supabase
        .from("port_calls")
        .update({
          arrival_time: nextArrivalTime,
          departure_time: nextDepartureTime,
          confidence: "erschlossen",
          source,
        })
        .eq("id", portCall.id);
      if (error) {
        console.error(`Liegezeit-Recherche: Schreiben fehlgeschlagen (${portCall.portName}):`, error.message);
        continue;
      }
      updatedCount += 1;
    }

    // Ein Kandidat hat etwas geliefert - keine weiteren Seiten mehr
    // versuchen, auch wenn nicht ALLE gelisteten Anläufe getroffen wurden
    // (die Seite hatte dafür schlicht nichts, ein zweiter Kandidat würde das
    // nicht ändern).
    if (updatedCount > 0) {
      return { ok: true, updatedCount };
    }
  }

  return { ok: true, updatedCount: 0 };
}
