import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_AUTO, RESEARCH_ENABLED, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildPortResearchPrompt } from "@/lib/prompts";
import {
  parseResearchFindings,
  SHARED_PORT_CATEGORIES,
  type ResearchCategory,
  type SightItem,
} from "@/lib/research-schema";
import { googleSearchUrl, lookupWikipediaImage } from "@/lib/wikimedia";
import { canonicalPortName, portNameVariants } from "@/lib/port-names";
import { loadAttempts, markAttempted, recordGaps, resolveGaps, withinAttemptLimit } from "@/lib/research-gaps";
import { buildWeatherFinding, getWeatherData } from "@/lib/weather";

export type PortResearchResult =
  | { ok: true; findings: Record<string, unknown>[] }
  | { ok: false; error: string };

// Themen, die per KI-Websuche recherchiert werden (wetter_packen kommt
// deterministisch aus Wetterdaten, sonstiges ist ein reiner Auffangwert -
// beide zählen daher nicht als "fehlendes Pflichtthema").
const AI_SHARED_PORT_CATEGORIES: ResearchCategory[] = [
  "anleger",
  "zu_fuss",
  "essen",
  "praktisches",
  "sehenswuerdigkeiten",
];
const AI_TRIP_PORT_CATEGORIES: ResearchCategory[] = ["ausflug_offiziell", "ausflug_privat"];

function nextSortOrder(rows: { sort_order: number | null }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1) + 1;
}

/**
 * Recherchiert für einen Hafenanlauf NUR die Themen nach, die für diesen Hafen
 * (port_research) bzw. diese Reise (research_findings) noch fehlen - bereits
 * vorhandene Funde bleiben unangetastet, statt bei jedem Aufruf komplett neu
 * (und damit teuer) recherchiert zu werden. Wetter/Packtipps kommen separat
 * aus historischen Wetterdaten, nicht per KI, und werden ebenfalls nur
 * ergänzt, wenn sie noch fehlen. Fehlende Bilder bei bereits vorhandenen
 * Sehenswürdigkeiten werden unabhängig davon nachgetragen.
 *
 * options.auto unterscheidet die beiden Aufrufwege, weil sie unterschiedlich
 * viel dürfen:
 *   - auto: true  = Hintergrund-Automatik (Reise hochladen/öffnen). Führt nur
 *     dann einen kostenpflichtigen Recherche-Lauf aus, wenn RESEARCH_AUTO an
 *     ist, und respektiert die Versuchsobergrenze aus research_gaps. Ist sie
 *     aus, wird die Lücke lediglich protokolliert - der Aufruf bleibt
 *     erfolgreich und liefert das, was schon da ist.
 *   - auto: false = bewusster Admin-Klick ("Jetzt/Erneut recherchieren").
 *     Recherchiert alles Fehlende ohne Versuchsbremse; nur der Hauptschalter
 *     RESEARCH_ENABLED kann ihn stoppen.
 *
 * Die kostenlose Anreicherung (Wetter aus Open-Meteo, Wikipedia-Bilder) läuft
 * in beiden Fällen und unabhängig davon, ob die KI-Recherche stattfindet.
 */
export async function researchAndSavePort(
  supabase: SupabaseClient,
  params: { tripId: string; portCallId: string; shipName: string; portName: string; callDate: string },
  options: { auto?: boolean } = {}
): Promise<PortResearchResult> {
  const { tripId, portCallId, shipName, portName, callDate } = params;
  const auto = options.auto ?? false;

  // Über alle bekannten Schreibweisen suchen (siehe lib/port-names.ts) -
  // sonst gilt Wissen, das unter "Colón" liegt, für den gebuchten "Colon" als
  // nicht vorhanden und wird teuer neu recherchiert.
  const { data: existingPort, error: existingPortError } = await supabase
    .from("port_research")
    .select("*")
    .in("port_name", portNameVariants(portName))
    .order("sort_order", { ascending: true });
  if (existingPortError) return { ok: false, error: existingPortError.message };

  const { data: existingTrip, error: existingTripError } = await supabase
    .from("research_findings")
    .select("*")
    .eq("trip_id", tripId)
    .eq("port_call_id", portCallId)
    .order("sort_order", { ascending: true });
  if (existingTripError) return { ok: false, error: existingTripError.message };

  const portRows = existingPort ?? [];
  const tripRows = existingTrip ?? [];

  const existingSharedCategories = new Set(portRows.map((r) => r.category));
  const existingTripCategories = new Set(tripRows.map((r) => r.category));

  const missingSharedCategories = AI_SHARED_PORT_CATEGORIES.filter((c) => !existingSharedCategories.has(c));
  const missingTripCategories = AI_TRIP_PORT_CATEGORIES.filter((c) => !existingTripCategories.has(c));
  const missingCategories = [...missingSharedCategories, ...missingTripCategories];

  let insertedPort: Record<string, unknown>[] = [];
  let insertedTrip: Record<string, unknown>[] = [];

  // Buchführung zuerst, unabhängig davon, ob gleich recherchiert wird: Was
  // fehlt, wird als offene Lücke festgehalten (und taucht damit im
  // Admin-Bereich auf), was inzwischen da ist, wird als erledigt geschlossen.
  const allAiCategories = [...AI_SHARED_PORT_CATEGORIES, ...AI_TRIP_PORT_CATEGORIES];
  await recordGaps({ scope: "hafen", subject: canonicalPortName(portName), categories: missingCategories, tripId });
  await resolveGaps(
    "hafen",
    canonicalPortName(portName),
    allAiCategories.filter((c) => !missingCategories.includes(c))
  );

  // Ein bewusster Admin-Klick, der wegen des Hauptschalters ins Leere läuft,
  // muss das melden - der Hintergrundlauf dagegen nicht, der arbeitet einfach
  // ohne KI weiter.
  if (!auto && missingCategories.length > 0 && !RESEARCH_ENABLED) {
    return { ok: false, error: "Recherche ist aktuell deaktiviert." };
  }

  let categoriesToResearch: ResearchCategory[] = [];
  if (missingCategories.length > 0 && RESEARCH_ENABLED) {
    if (!auto) {
      categoriesToResearch = missingCategories;
    } else if (RESEARCH_AUTO) {
      // Versuchsbremse: ein Thema, das die Websuche schon mehrfach nicht
      // geliefert hat, löst keinen weiteren Lauf mehr aus. Ohne diese Bremse
      // hat früher jeder einzelne Seitenaufruf der Reise einen neuen
      // Sonnet-Lauf mit bis zu 6 Suchen für dasselbe Thema gestartet.
      const attempts = await loadAttempts("hafen", canonicalPortName(portName));
      categoriesToResearch = withinAttemptLimit(missingCategories, attempts) as ResearchCategory[];
    }
  }

  if (categoriesToResearch.length > 0) {
    // Versuch vermerken, BEVOR der Aufruf läuft: Bricht er ab (Timeout,
    // Token-Limit, ungültiges JSON), ist der Versuch trotzdem passiert und
    // muss gegen die Obergrenze zählen - sonst wäre die Bremse wirkungslos.
    await markAttempted({ scope: "hafen", subject: canonicalPortName(portName), categories: categoriesToResearch, tripId });

    const response = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      system: buildPortResearchPrompt(shipName, portName, callDate, categoriesToResearch),
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `Recherchiere Informationen zu den fehlenden Themen (${categoriesToResearch.join(", ")}) für den Hafenanlauf in "${portName}" am ${callDate}.`,
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
    }

    // Bilder werden nicht per Websuche gesucht (unzuverlässig, siehe
    // buildPortResearchPrompt), sondern hier deterministisch über die
    // Wikipedia-API nachgeschlagen.
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

    const sharedFindings = findings.filter((f) => SHARED_PORT_CATEGORIES.includes(f.category));
    const tripFindings = findings.filter((f) => !SHARED_PORT_CATEGORIES.includes(f.category));

    if (sharedFindings.length > 0) {
      let sortOrder = nextSortOrder(portRows);
      const rows = sharedFindings.map((f) => ({
        port_name: canonicalPortName(portName),
        category: f.category,
        title: f.title,
        content: f.content,
        items: f.items ?? null,
        source_tier: f.source_tier,
        source_name: f.source_name,
        source_url: f.source_url,
        staleness: f.staleness,
        sort_order: sortOrder++,
      }));
      const { data, error } = await supabase.from("port_research").insert(rows).select();
      if (error) return { ok: false, error: error.message };
      insertedPort = data ?? [];
      portRows.push(...insertedPort);
    }

    if (tripFindings.length > 0) {
      let sortOrder = nextSortOrder(tripRows);
      const rows = tripFindings.map((f) => ({
        trip_id: tripId,
        port_call_id: portCallId,
        category: f.category,
        title: f.title,
        content: f.content,
        source_tier: f.source_tier,
        source_name: f.source_name,
        source_url: f.source_url,
        staleness: f.staleness,
        sort_order: sortOrder++,
      }));
      const { data, error } = await supabase.from("research_findings").insert(rows).select();
      if (error) return { ok: false, error: error.message };
      insertedTrip = data ?? [];
      tripRows.push(...insertedTrip);
    }

    // Nur die Themen schließen, die der Lauf tatsächlich geliefert hat. Was
    // angefragt war, aber nicht zurückkam, bleibt als offene Lücke stehen -
    // mit einem verbrauchten Versuch mehr auf dem Konto.
    await resolveGaps(
      "hafen",
      canonicalPortName(portName),
      findings.map((f) => f.category).filter((c) => categoriesToResearch.includes(c))
    );
  }

  // Wetter/Packtipps kommen nicht von der KI, sondern werden deterministisch
  // aus historischen Open-Meteo-Daten berechnet - unabhängig vom obigen
  // AI-Aufruf ergänzt, falls für diesen Hafen noch keine Zeile existiert.
  if (!existingSharedCategories.has("wetter_packen")) {
    const weatherData = await getWeatherData(portName, callDate);
    if (weatherData) {
      const weatherFinding = buildWeatherFinding(portName, callDate, weatherData);
      // upsert statt insert: verhindert Duplikate, wenn zwei Requests für
      // dieselbe Reise nahezu gleichzeitig hier ankommen (siehe
      // idx_port_research_unique_auto in supabase/schema.sql) - die
      // "existiert schon?"-Prüfung oben ist dagegen allein keine Sperre,
      // sondern nur eine Kostenoptimierung für den Normalfall.
      const { data, error } = await supabase
        .from("port_research")
        .upsert(
          {
            port_name: canonicalPortName(portName),
            category: weatherFinding.category,
            title: weatherFinding.title,
            content: weatherFinding.content,
            source_tier: weatherFinding.source_tier,
            source_name: weatherFinding.source_name,
            source_url: weatherFinding.source_url,
            staleness: weatherFinding.staleness,
            sort_order: nextSortOrder(portRows),
          },
          { onConflict: "port_name,category", ignoreDuplicates: true }
        )
        .select();
      if (error) return { ok: false, error: error.message };
      insertedPort = [...insertedPort, ...(data ?? [])];
      portRows.push(...(data ?? []));
    }
  }

  // Fehlende Bilder bei bereits vorhandenen Sehenswürdigkeiten nachtragen -
  // z. B. wenn der Wikipedia-Lookup beim ursprünglichen Lauf fehlgeschlagen
  // ist oder die Zeile aus einer Zeit vor der Bild-Ergänzung stammt.
  const sightsRow = portRows.find(
    (r) => r.category === "sehenswuerdigkeiten" && Array.isArray(r.items) && r.items.length > 0
  );
  if (sightsRow) {
    const items = sightsRow.items as SightItem[];
    if (items.some((item) => !item.image_url)) {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.image_url) return item;
          const lookup = await lookupWikipediaImage(item.name);
          return {
            ...item,
            image_url: lookup?.url ?? null,
            image_source: lookup?.source ?? null,
            article_url: lookup?.articleUrl ?? item.article_url ?? googleSearchUrl(`${item.name} ${portName}`),
          };
        })
      );
      const { error: updateError } = await supabase
        .from("port_research")
        .update({ items: updatedItems })
        .eq("id", sightsRow.id);
      if (!updateError) {
        sightsRow.items = updatedItems;
      } else {
        console.error(`Hafenrecherche (${portName}): Nachtragen der Sehenswürdigkeiten-Bilder fehlgeschlagen:`, updateError.message);
      }
    }
  }

  return {
    ok: true,
    // port_research-Zeilen kennen keinen port_call_id - für die Anzeige auf
    // dieser Reise wird er hier ergänzt, ohne ihn in der geteilten Tabelle zu speichern.
    findings: [...portRows.map((r) => ({ ...r, port_call_id: portCallId })), ...tripRows],
  };
}

/**
 * Der Automatik-Weg: aufgerufen nach dem Hochladen einer Reise (/api/confirm)
 * und beim Laden einer Reise (/api/trips/[id]). Löst mit RESEARCH_AUTO = false
 * KEINEN kostenpflichtigen Recherche-Aufruf aus, sondern hält fehlende Themen
 * nur als Lücke fest; die kostenlose Anreicherung (Wetter, Wikipedia-Bilder)
 * läuft weiter. Steht RESEARCH_AUTO wieder auf true, recherchiert er fehlende
 * Themen im Hintergrund nach - begrenzt durch die Versuchsobergrenze, damit
 * ein hartnäckig unbeantwortbares Thema kein Dauerkostenleck wird.
 */
export async function ensurePortResearched(
  supabase: SupabaseClient,
  params: { tripId: string; portCallId: string; shipName: string; portName: string; callDate: string }
): Promise<PortResearchResult> {
  return researchAndSavePort(supabase, params, { auto: true });
}
