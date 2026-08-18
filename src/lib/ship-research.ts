import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildShipResearchPrompt, buildCabinResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";

export type ShipResearchResult =
  | { ok: true; findings: unknown[] }
  | { ok: false; error: string };

// Schiffs-/Kabineninfos (ship_research) gelten für diese Zeitspanne als
// aktuell - danach wird bei Gelegenheit erneut recherchiert statt der Cache
// blind vertraut. Gleicher Schwellwert wie der wöchentliche Cron
// (STALE_AFTER_DAYS in cron/refresh-ship-research/route.ts) und wie
// PORT_RESEARCH_CACHE_MAX_AGE_DAYS in port-research.ts.
export const SHIP_RESEARCH_CACHE_MAX_AGE_DAYS = 7;

async function runResearch(
  system: string,
  userMessage: string,
  logLabel: string
): Promise<{ ok: true; findings: ReturnType<typeof parseResearchFindings> } | { ok: false; error: string }> {
  const response = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 16000,
    // Strukturierte Extraktion nach Websuche statt tiefem Reasoning - "medium"
    // spart Tokens gegenüber dem Default "high" ohne spürbaren Qualitätsverlust.
    output_config: { effort: "medium" },
    system,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (response.stop_reason === "max_tokens") {
    console.error(`${logLabel}: Antwort durch max_tokens abgeschnitten.\nRohtext:\n`, rawText);
    return { ok: false, error: "Durch Token-Limit abgeschnitten." };
  }

  const findings = parseResearchFindings(rawText);
  if (findings.length === 0) {
    console.error(
      `${logLabel}: keine Findings geparst. Block-Typen:`,
      response.content.map((b) => b.type),
      "\nRohtext:\n", rawText
    );
    return { ok: false, error: "Keine Findings geparst." };
  }

  return { ok: true, findings };
}

/**
 * Führt die Websuche-Recherche für ein Schiff aus und ersetzt die
 * gespeicherten allgemeinen Schiffsinfos (cabin_category IS NULL) für diesen
 * Schiffsnamen. Gemeinsam genutzt vom manuellen "Erneut recherchieren"-
 * Endpunkt und vom periodischen Refresh-Cron. Kabinenkategorie-spezifische
 * Funde (siehe researchAndSaveCabin) bleiben davon unberührt.
 */
export async function researchAndSaveShip(
  supabase: SupabaseClient,
  shipName: string
): Promise<ShipResearchResult> {
  const result = await runResearch(
    buildShipResearchPrompt(shipName),
    `Recherchiere Informationen zum Kreuzfahrtschiff "${shipName}".`,
    `Schiffsrecherche (${shipName})`
  );
  if (!result.ok) return result;

  const { error: deleteError } = await supabase
    .from("ship_research")
    .delete()
    .eq("ship_name", shipName)
    .is("cabin_category", null);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = result.findings.map((f, i) => ({
    ship_name: shipName,
    cabin_category: null,
    category: f.category,
    title: f.title,
    content: f.content,
    source_tier: f.source_tier,
    source_name: f.source_name,
    source_url: f.source_url,
    staleness: f.staleness,
    sort_order: i,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("ship_research")
    .insert(rows)
    .select();
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, findings: inserted ?? [] };
}

/**
 * Analog zu researchAndSaveShip, aber für eine konkret gebuchte
 * Kabinenkategorie. cabinLabel ist die reine Kategorie oder "Kategorie ·
 * Deck N" (siehe cabinLabel() in src/lib/cabin.ts) - geteilt über alle
 * Reisen mit derselben Schiff+Kategorie(+Deck)-Kombination. buildCabinResearchPrompt
 * parst das Deck selbst wieder aus dem Label heraus.
 */
export async function researchAndSaveCabin(
  supabase: SupabaseClient,
  shipName: string,
  cabinLabel: string
): Promise<ShipResearchResult> {
  const result = await runResearch(
    buildCabinResearchPrompt(shipName, cabinLabel),
    `Recherchiere Informationen zur Kabinenkategorie "${cabinLabel}" auf dem Kreuzfahrtschiff "${shipName}".`,
    `Kabinenrecherche (${shipName} / ${cabinLabel})`
  );
  if (!result.ok) return result;

  const { error: deleteError } = await supabase
    .from("ship_research")
    .delete()
    .eq("ship_name", shipName)
    .eq("cabin_category", cabinLabel);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = result.findings.map((f, i) => ({
    ship_name: shipName,
    cabin_category: cabinLabel,
    category: f.category,
    title: f.title,
    content: f.content,
    source_tier: f.source_tier,
    source_name: f.source_name,
    source_url: f.source_url,
    staleness: f.staleness,
    sort_order: i,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("ship_research")
    .insert(rows)
    .select();
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, findings: inserted ?? [] };
}

/**
 * Recherchiert die allgemeinen Schiffsinfos nur, wenn kein aktueller
 * Cache-Treffer existiert (analog zu ensurePortResearched in
 * port-research.ts). Für den automatischen Anstoß beim Laden einer Reise
 * (/api/trips/[id]), damit Nutzer:innen keinen manuellen Trigger mehr
 * brauchen.
 */
export async function ensureShipResearched(
  supabase: SupabaseClient,
  shipName: string
): Promise<ShipResearchResult> {
  const cutoff = new Date(Date.now() - SHIP_RESEARCH_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached, error } = await supabase
    .from("ship_research")
    .select("*")
    .eq("ship_name", shipName)
    .is("cabin_category", null)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const hasFreshRow = (cached ?? []).some(
    (r) => typeof r.retrieved_at === "string" && r.retrieved_at >= cutoff
  );
  if (hasFreshRow) return { ok: true, findings: cached ?? [] };

  return researchAndSaveShip(supabase, shipName);
}

/**
 * Analog zu ensureShipResearched, aber für eine konkrete Kabinenkategorie
 * (cabinLabel wie bei researchAndSaveCabin).
 */
export async function ensureCabinResearched(
  supabase: SupabaseClient,
  shipName: string,
  cabinLabel: string
): Promise<ShipResearchResult> {
  const cutoff = new Date(Date.now() - SHIP_RESEARCH_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached, error } = await supabase
    .from("ship_research")
    .select("*")
    .eq("ship_name", shipName)
    .eq("cabin_category", cabinLabel)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const hasFreshRow = (cached ?? []).some(
    (r) => typeof r.retrieved_at === "string" && r.retrieved_at >= cutoff
  );
  if (hasFreshRow) return { ok: true, findings: cached ?? [] };

  return researchAndSaveCabin(supabase, shipName, cabinLabel);
}
