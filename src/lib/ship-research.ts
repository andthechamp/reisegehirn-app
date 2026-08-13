import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildShipResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";

export type ShipResearchResult =
  | { ok: true; findings: unknown[] }
  | { ok: false; error: string };

/**
 * Führt die Websuche-Recherche für ein Schiff aus und ersetzt die
 * gespeicherten Schiffsinfos für diesen Schiffsnamen. Gemeinsam genutzt vom
 * manuellen "Erneut recherchieren"-Endpunkt und vom periodischen Refresh-Cron.
 */
export async function researchAndSaveShip(
  supabase: SupabaseClient,
  shipName: string
): Promise<ShipResearchResult> {
  const response = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 16000,
    system: buildShipResearchPrompt(shipName),
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `Recherchiere Informationen zum Kreuzfahrtschiff "${shipName}".`,
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (response.stop_reason === "max_tokens") {
    console.error(`Schiffsrecherche (${shipName}): Antwort durch max_tokens abgeschnitten.\nRohtext:\n`, rawText);
    return { ok: false, error: "Durch Token-Limit abgeschnitten." };
  }

  const findings = parseResearchFindings(rawText);
  if (findings.length === 0) {
    console.error(
      `Schiffsrecherche (${shipName}): keine Findings geparst. Block-Typen:`,
      response.content.map((b) => b.type),
      "\nRohtext:\n", rawText
    );
    return { ok: false, error: "Keine Findings geparst." };
  }

  const { error: deleteError } = await supabase
    .from("ship_research")
    .delete()
    .eq("ship_name", shipName);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = findings.map((f, i) => ({
    ship_name: shipName,
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
