import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildPortResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings, SHARED_PORT_CATEGORIES } from "@/lib/research-schema";

export type PortResearchResult =
  | { ok: true; findings: Record<string, unknown>[] }
  | { ok: false; error: string };

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
    system: buildPortResearchPrompt(shipName, portName, callDate),
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
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

  const sharedFindings = findings.filter((f) => SHARED_PORT_CATEGORIES.includes(f.category));
  const tripFindings = findings.filter((f) => !SHARED_PORT_CATEGORIES.includes(f.category));

  const { error: deletePortError } = await supabase.from("port_research").delete().eq("port_name", portName);
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

  return {
    ok: true,
    // port_research-Zeilen kennen keinen port_call_id - für die Anzeige auf
    // dieser Reise wird er hier ergänzt, ohne ihn in der geteilten Tabelle zu speichern.
    findings: [...insertedPort.map((r) => ({ ...r, port_call_id: portCallId })), ...insertedTrip],
  };
}
