import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildShipResearchPrompt, buildCabinResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";

export type ShipResearchResult =
  | { ok: true; findings: unknown[] }
  | { ok: false; error: string };

async function runResearch(
  system: string,
  userMessage: string,
  logLabel: string
): Promise<{ ok: true; findings: ReturnType<typeof parseResearchFindings> } | { ok: false; error: string }> {
  const response = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 16000,
    system,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
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
 * Kabinenkategorie (siehe normalizeCabinCategory in src/lib/cabin.ts). Geteilt
 * über alle Reisen mit derselben Schiff+Kategorie-Kombination.
 */
export async function researchAndSaveCabin(
  supabase: SupabaseClient,
  shipName: string,
  cabinCategory: string
): Promise<ShipResearchResult> {
  const result = await runResearch(
    buildCabinResearchPrompt(shipName, cabinCategory),
    `Recherchiere Informationen zur Kabinenkategorie "${cabinCategory}" auf dem Kreuzfahrtschiff "${shipName}".`,
    `Kabinenrecherche (${shipName} / ${cabinCategory})`
  );
  if (!result.ok) return result;

  const { error: deleteError } = await supabase
    .from("ship_research")
    .delete()
    .eq("ship_name", shipName)
    .eq("cabin_category", cabinCategory);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = result.findings.map((f, i) => ({
    ship_name: shipName,
    cabin_category: cabinCategory,
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
