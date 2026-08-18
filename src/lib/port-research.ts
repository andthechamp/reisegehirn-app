import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildPortResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings, SHARED_PORT_CATEGORIES } from "@/lib/research-schema";
import { googleSearchUrl, lookupWikipediaImage } from "@/lib/wikimedia";
import { buildWeatherFinding, getWeatherData } from "@/lib/weather";

export type PortResearchResult =
  | { ok: true; findings: Record<string, unknown>[] }
  | { ok: false; error: string };

// Geteiltes Hafenwissen (port_research) gilt für diese Zeitspanne als aktuell -
// danach wird bei Gelegenheit erneut recherchiert statt der Cache blind vertraut.
export const PORT_RESEARCH_CACHE_MAX_AGE_DAYS = 7;

/**
 * Führt die Websuche-Recherche für einen Hafenanlauf aus und ersetzt die
 * gespeicherten Ergebnisse. Hafenunabhängiges Wissen (Anleger, zu Fuß, Essen,
 * Praktisches, Sehenswürdigkeiten, Wetter/Packen) landet geteilt über alle
 * Reisen hinweg in port_research (geschlüsselt über port_name, analog
 * ship_research). Reederei-/private Ausflüge bleiben trip-spezifisch in
 * research_findings, da sich das Angebot je Schiff/Reederei unterscheiden kann.
 */
export async function researchAndSavePort(
  supabase: SupabaseClient,
  params: { tripId: string; portCallId: string; shipName: string; portName: string; callDate: string }
): Promise<PortResearchResult> {
  const { tripId, portCallId, shipName, portName, callDate } = params;

  const response = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 16000,
    // Strukturierte Extraktion nach Websuche statt tiefem Reasoning - "medium"
    // spart Tokens gegenüber dem Default "high" ohne spürbaren Qualitätsverlust.
    output_config: { effort: "medium" },
    system: buildPortResearchPrompt(shipName, portName, callDate),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `Recherchiere Informationen zum Hafenanlauf in "${portName}" am ${callDate}.`,
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (response.stop_reason === "max_tokens") {
    console.error(`Hafenrecherche (${portName}): Antwort durch max_tokens abgeschnitten.\nRohtext:\n`, rawText);
    return { ok: false, error: "Durch Token-Limit abgeschnitten." };
  }

  const findings = parseResearchFindings(rawText);
  if (findings.length === 0) {
    console.error(
      `Hafenrecherche (${portName}): keine Findings geparst. Block-Typen:`,
      response.content.map((b) => b.type),
      "\nRohtext:\n", rawText
    );
    return { ok: false, error: "Keine Findings geparst." };
  }

  // Bilder werden nicht mehr von der KI per Websuche gesucht (unzuverlässig,
  // siehe buildPortResearchPrompt) - stattdessen hier deterministisch über
  // die Wikipedia-API nachgeschlagen, ein kostenloser HTTP-Call pro
  // Sehenswürdigkeit statt eines KI-Aufrufs. Liefert dabei auch gleich den
  // "Mehr erfahren"-Link (Wikipedia-Artikel, sonst Google-Suche als Fallback).
  const sehenswuerdigkeitenFinding = findings.find((f) => f.category === "sehenswuerdigkeiten" && f.items);
  if (sehenswuerdigkeitenFinding?.items) {
    sehenswuerdigkeitenFinding.items = await Promise.all(
      sehenswuerdigkeitenFinding.items.map(async (item) => {
        const lookup = await lookupWikipediaImage(item.name);
        return {
          ...item,
          image_url: lookup?.url ?? null,
          image_source: lookup?.source ?? null,
          article_url: lookup?.articleUrl ?? googleSearchUrl(`${item.name} ${portName}`),
        };
      })
    );
  }

  // Wetter/Packtipps kommen nicht mehr von der KI (siehe buildPortResearchPrompt),
  // sondern werden hier aus historischen Open-Meteo-Daten berechnet und als
  // eigener Finding-Eintrag ergänzt. Kein Fund (z. B. Geocoding fehlgeschlagen)
  // -> Thema fällt weg, statt eine falsche/erfundene Angabe zu zeigen.
  const weatherData = await getWeatherData(portName, callDate);
  if (weatherData) {
    findings.push(buildWeatherFinding(portName, callDate, weatherData));
  }

  const sharedFindings = findings.filter((f) => SHARED_PORT_CATEGORIES.includes(f.category));
  const tripFindings = findings.filter((f) => !SHARED_PORT_CATEGORIES.includes(f.category));

  // curated = true bleibt beim Neu-Recherchieren erhalten (z. B. redaktionell
  // aus einer Reisebüro-Tippliste eingepflegte Einträge) - nur die von der
  // KI-Websuche erzeugten Zeilen (curated = false) werden ersetzt.
  const { error: deletePortError } = await supabase
    .from("port_research")
    .delete()
    .eq("port_name", portName)
    .eq("curated", false);
  if (deletePortError) return { ok: false, error: deletePortError.message };

  const { error: deleteTripError } = await supabase
    .from("research_findings")
    .delete()
    .eq("trip_id", tripId)
    .eq("port_call_id", portCallId);
  if (deleteTripError) return { ok: false, error: deleteTripError.message };

  let insertedPort: Record<string, unknown>[] = [];
  if (sharedFindings.length > 0) {
    const rows = sharedFindings.map((f, i) => ({
      port_name: portName,
      category: f.category,
      title: f.title,
      content: f.content,
      items: f.items ?? null,
      source_tier: f.source_tier,
      source_name: f.source_name,
      source_url: f.source_url,
      staleness: f.staleness,
      sort_order: i,
    }));
    const { data, error } = await supabase.from("port_research").insert(rows).select();
    if (error) return { ok: false, error: error.message };
    insertedPort = data ?? [];
  }

  let insertedTrip: Record<string, unknown>[] = [];
  if (tripFindings.length > 0) {
    const rows = tripFindings.map((f, i) => ({
      trip_id: tripId,
      port_call_id: portCallId,
      category: f.category,
      title: f.title,
      content: f.content,
      source_tier: f.source_tier,
      source_name: f.source_name,
      source_url: f.source_url,
      staleness: f.staleness,
      sort_order: i,
    }));
    const { data, error } = await supabase.from("research_findings").insert(rows).select();
    if (error) return { ok: false, error: error.message };
    insertedTrip = data ?? [];
  }

  // Kuratierte Zeilen (z. B. redaktionelle Insider-Tipps) werden oben bewusst
  // nicht gelöscht/neu eingefügt - ohne diesen Nachschlag würden sie im
  // Response einer frischen Recherche fehlen, obwohl sie in der DB stehen.
  const { data: curatedPort, error: curatedPortError } = await supabase
    .from("port_research")
    .select("*")
    .eq("port_name", portName)
    .eq("curated", true)
    .order("sort_order", { ascending: true });
  if (curatedPortError) return { ok: false, error: curatedPortError.message };

  return {
    ok: true,
    // port_research-Zeilen kennen keinen port_call_id - für die Anzeige auf
    // dieser Reise wird er hier ergänzt, ohne ihn in der geteilten Tabelle zu speichern.
    findings: [
      ...(curatedPort ?? []).map((r) => ({ ...r, port_call_id: portCallId })),
      ...insertedPort.map((r) => ({ ...r, port_call_id: portCallId })),
      ...insertedTrip,
    ],
  };
}

/**
 * Recherchiert einen Hafenanlauf nur, wenn kein aktueller Cache-Treffer in
 * port_research existiert (analog zum Cache-Check in /api/research/port,
 * aber ohne die Response-Formatierung fürs Frontend). Für den automatischen
 * Anstoß direkt nach dem Hochladen einer Reise (/api/confirm), damit nicht
 * jeder Hafen einer bereits recherchierten Route unnötig neu gesucht wird.
 */
export async function ensurePortResearched(
  supabase: SupabaseClient,
  params: { tripId: string; portCallId: string; shipName: string; portName: string; callDate: string }
): Promise<PortResearchResult> {
  const cutoff = new Date(Date.now() - PORT_RESEARCH_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedPort, error: cachedPortError } = await supabase
    .from("port_research")
    .select("*")
    .eq("port_name", params.portName)
    .order("sort_order", { ascending: true });
  if (cachedPortError) return { ok: false, error: cachedPortError.message };

  // Ob eine neue KI-Recherche nötig ist, entscheidet sich ausschließlich an
  // den nicht-kuratierten (curated = false) Zeilen - kuratierte Einträge
  // unterliegen keiner Alters-Prüfung (redaktionell gepflegt, kein
  // Websuche-Ergebnis, das veralten kann) und dürfen daher allein keinen
  // Cache-Treffer vortäuschen, wenn die AI-Kategorien noch nie recherchiert wurden.
  const hasFreshAiRow = (cachedPort ?? []).some(
    (r) => r.curated !== true && typeof r.retrieved_at === "string" && r.retrieved_at >= cutoff
  );
  if (hasFreshAiRow) {
    return { ok: true, findings: (cachedPort ?? []).map((r) => ({ ...r, port_call_id: params.portCallId })) };
  }

  return researchAndSavePort(supabase, params);
}
