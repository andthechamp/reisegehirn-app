import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, RESEARCH_AUTO, RESEARCH_ENABLED, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildShipResearchPrompt, buildCabinResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";
import {
  ALL_CATEGORIES,
  loadAttempts,
  markAttempted,
  recordGaps,
  resolveGaps,
  withinAttemptLimit,
  type GapScope,
} from "@/lib/research-gaps";

export type ShipResearchResult =
  | { ok: true; findings: unknown[] }
  | { ok: false; error: string };

/**
 * Entscheidet für Schiff/Kabine, ob ein kostenpflichtiger Recherche-Lauf
 * stattfinden darf, und führt dabei die Lücken-Buchführung. Anders als beim
 * Hafen gibt es hier keine Einzelthemen - für ein Schiff bzw. eine
 * Kabinenkategorie liegt entweder ein Fundsatz vor oder gar keiner, daher
 * ALL_CATEGORIES als Platzhalter.
 */
async function mayResearch(params: {
  scope: GapScope;
  subject: string;
  shipName: string | null;
  auto: boolean;
}): Promise<{ allowed: true } | { allowed: false; reason: string | null }> {
  const { scope, subject, shipName, auto } = params;

  await recordGaps({ scope, subject, categories: [ALL_CATEGORIES], shipName });

  if (!RESEARCH_ENABLED) {
    // Bewusster Admin-Klick soll erfahren, warum nichts passiert; die
    // Hintergrund-Automatik schweigt und lässt die Lücke einfach stehen.
    return { allowed: false, reason: auto ? null : "Recherche ist aktuell deaktiviert." };
  }

  if (!auto) return { allowed: true };

  if (!RESEARCH_AUTO) {
    // Automatik aus: Lücke ist protokolliert, gefüllt wird sie redaktionell
    // oder per bewusstem Klick im Admin-Bereich.
    return { allowed: false, reason: null };
  }

  const attempts = await loadAttempts(scope, subject);
  if (withinAttemptLimit([ALL_CATEGORIES], attempts).length === 0) {
    console.warn(`Recherche (${scope}/${subject}): Versuchsobergrenze erreicht, Automatik überspringt.`);
    return { allowed: false, reason: null };
  }

  await markAttempted({ scope, subject, categories: [ALL_CATEGORIES], shipName });
  return { allowed: true };
}

async function runResearch(
  system: string,
  userMessage: string,
  logLabel: string
): Promise<{ ok: true; findings: ReturnType<typeof parseResearchFindings> } | { ok: false; error: string }> {
  const response = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 16000,
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
 * Führt die Websuche-Recherche für ein Schiff aus, aber NUR, wenn für diesen
 * Schiffsnamen noch KEINE allgemeinen Schiffsinfos (cabin_category IS NULL)
 * vorhanden sind - vorhandene Funde bleiben unangetastet statt bei jedem
 * Aufruf teuer neu recherchiert zu werden. Kabinenkategorie-spezifische Funde
 * (siehe researchAndSaveCabin) bleiben davon ohnehin unberührt.
 */
export async function researchAndSaveShip(
  supabase: SupabaseClient,
  shipName: string,
  options: { auto?: boolean } = {}
): Promise<ShipResearchResult> {
  const auto = options.auto ?? false;

  const { data: existing, error: existingError } = await supabase
    .from("ship_research")
    .select("*")
    .eq("ship_name", shipName)
    .is("cabin_category", null)
    .order("sort_order", { ascending: true });
  if (existingError) return { ok: false, error: existingError.message };
  if ((existing ?? []).length > 0) {
    await resolveGaps("schiff", shipName, [ALL_CATEGORIES]);
    return { ok: true, findings: existing ?? [] };
  }

  const gate = await mayResearch({ scope: "schiff", subject: shipName, shipName: null, auto });
  if (!gate.allowed) {
    return gate.reason ? { ok: false, error: gate.reason } : { ok: true, findings: [] };
  }

  const result = await runResearch(
    buildShipResearchPrompt(shipName),
    `Recherchiere Informationen zum Kreuzfahrtschiff "${shipName}".`,
    `Schiffsrecherche (${shipName})`
  );
  if (!result.ok) return result;

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

  await resolveGaps("schiff", shipName, [ALL_CATEGORIES]);
  return { ok: true, findings: inserted ?? [] };
}

/**
 * Analog zu researchAndSaveShip (nur recherchieren, wenn noch nichts
 * vorhanden ist), aber für eine konkret gebuchte Kabinenkategorie. cabinLabel
 * ist die reine Kategorie oder "Kategorie · Deck N" (siehe cabinLabel() in
 * src/lib/cabin.ts) - geteilt über alle Reisen mit derselben
 * Schiff+Kategorie(+Deck)-Kombination. buildCabinResearchPrompt parst das
 * Deck selbst wieder aus dem Label heraus.
 */
export async function researchAndSaveCabin(
  supabase: SupabaseClient,
  shipName: string,
  cabinLabel: string,
  options: { auto?: boolean } = {}
): Promise<ShipResearchResult> {
  const auto = options.auto ?? false;

  const { data: existing, error: existingError } = await supabase
    .from("ship_research")
    .select("*")
    .eq("ship_name", shipName)
    .eq("cabin_category", cabinLabel)
    .order("sort_order", { ascending: true });
  if (existingError) return { ok: false, error: existingError.message };
  if ((existing ?? []).length > 0) {
    await resolveGaps("kabine", cabinLabel, [ALL_CATEGORIES]);
    return { ok: true, findings: existing ?? [] };
  }

  const gate = await mayResearch({ scope: "kabine", subject: cabinLabel, shipName, auto });
  if (!gate.allowed) {
    return gate.reason ? { ok: false, error: gate.reason } : { ok: true, findings: [] };
  }

  const result = await runResearch(
    buildCabinResearchPrompt(shipName, cabinLabel),
    `Recherchiere Informationen zur Kabinenkategorie "${cabinLabel}" auf dem Kreuzfahrtschiff "${shipName}".`,
    `Kabinenrecherche (${shipName} / ${cabinLabel})`
  );
  if (!result.ok) return result;

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

  await resolveGaps("kabine", cabinLabel, [ALL_CATEGORIES]);
  return { ok: true, findings: inserted ?? [] };
}

/**
 * Der Automatik-Weg beim Laden einer Reise (/api/trips/[id]). Mit
 * RESEARCH_AUTO = false wird eine fehlende Schiffsrecherche nur als Lücke
 * protokolliert, nicht ausgeführt - siehe mayResearch.
 */
export async function ensureShipResearched(
  supabase: SupabaseClient,
  shipName: string
): Promise<ShipResearchResult> {
  return researchAndSaveShip(supabase, shipName, { auto: true });
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
  return researchAndSaveCabin(supabase, shipName, cabinLabel, { auto: true });
}
