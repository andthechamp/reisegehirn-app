import { getSupabaseAdminClient } from "@/lib/supabase";

// Wie oft die AUTOMATISCHE Recherche (RESEARCH_AUTO, siehe lib/anthropic.ts)
// ein einzelnes Thema erfolglos versuchen darf, bevor sie es endgültig liegen
// lässt. Vorher galt "keine Zeile in der DB" = "muss neu recherchiert werden",
// wodurch ein Thema, das die Websuche partout nicht liefert, bei JEDEM Laden
// der Reise einen neuen Sonnet-Lauf mit bis zu 6 Suchen ausgelöst hat. Ein
// manueller Admin-Aufruf ("Erneut recherchieren") ignoriert diese Bremse -
// wer bewusst klickt, weiß, was er auslöst.
export const MAX_AUTO_ATTEMPTS = 2;

// Platzhalter-Kategorie für "hier fehlt bislang alles" (Schiff/Kabine kennen
// keine Einzelthemen wie der Hafen, dort ist es alles oder nichts).
export const ALL_CATEGORIES = "*";

export type GapScope = "hafen" | "schiff" | "kabine";

export type ResearchGap = {
  id: string;
  scope: GapScope;
  subject: string;
  ship_name: string | null;
  category: string;
  last_trip_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  attempts: number;
  last_attempt_at: string | null;
  resolved_at: string | null;
};

// Buchführung über fehlende Recherche ist Betriebs-Nebensache: Sie darf einen
// echten Request niemals scheitern lassen. Alle Funktionen hier fangen ihre
// Fehler daher selbst ab und loggen nur - der Aufrufer bekommt kein Problem
// serviert, das seine eigentliche Aufgabe nicht betrifft. Aus demselben Grund
// läuft alles über den Service-Role-Client statt über den Client des
// Aufrufers: research_gaps hat bewusst keine RLS-Policies (siehe schema.sql),
// wäre also aus einem nutzergebundenen Client heraus nicht beschreibbar.
function adminClient() {
  return getSupabaseAdminClient();
}

/**
 * Hält fest, dass für ein Subjekt (Hafen/Schiff/Kabinenkategorie) die
 * genannten Themen fehlen. Existiert die Lücke schon, wird sie nicht
 * dupliziert, sondern als "wieder gebraucht" hochgezählt (seen_count) - so
 * lässt sich im Admin-Bereich sortieren, welche Lücke die Redaktion zuerst
 * verdient.
 */
export async function recordGaps(params: {
  scope: GapScope;
  subject: string;
  categories: string[];
  shipName?: string | null;
  tripId?: string | null;
}): Promise<void> {
  const { scope, subject, categories, shipName = null, tripId = null } = params;
  if (categories.length === 0) return;

  try {
    const supabase = adminClient();
    const now = new Date().toISOString();

    // Bestehende Zeilen zuerst lesen, damit seen_count hochgezählt statt
    // zurückgesetzt wird - ein reines upsert würde den Zähler bei jedem
    // Aufruf wieder auf 1 setzen und damit genau die Information vernichten,
    // wegen der die Spalte existiert.
    const { data: existing, error: readError } = await supabase
      .from("research_gaps")
      .select("id, category, seen_count")
      .eq("scope", scope)
      .eq("subject", subject)
      .in("category", categories);
    if (readError) throw readError;

    const existingByCategory = new Map(
      (existing ?? []).map((row) => [row.category as string, row as { id: string; seen_count: number }])
    );

    const newCategories = categories.filter((c) => !existingByCategory.has(c));
    if (newCategories.length > 0) {
      const { error } = await supabase.from("research_gaps").insert(
        newCategories.map((category) => ({
          scope,
          subject,
          ship_name: shipName,
          category,
          last_trip_id: tripId,
        }))
      );
      if (error) throw error;
    }

    for (const [, row] of existingByCategory) {
      const { error } = await supabase
        .from("research_gaps")
        .update({
          seen_count: row.seen_count + 1,
          last_seen_at: now,
          last_trip_id: tripId,
          // Eine Lücke, die erneut auffällt, gilt wieder als offen - z. B.
          // wenn eine früher gefüllte Kategorie später gelöscht wurde.
          resolved_at: null,
        })
        .eq("id", row.id);
      if (error) throw error;
    }
  } catch (err) {
    console.error(`Recherche-Lücke konnte nicht protokolliert werden (${scope}/${subject}):`, err);
  }
}

/**
 * Liefert je Kategorie, wie oft die automatische Recherche sie schon erfolglos
 * versucht hat. Fehlt eine Kategorie in der Map, wurde sie noch nie versucht.
 * Bei einem Fehler kommt bewusst eine leere Map zurück: im Zweifel lieber
 * einmal zu viel recherchieren als eine Lücke für immer offen lassen.
 */
export async function loadAttempts(scope: GapScope, subject: string): Promise<Map<string, number>> {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("research_gaps")
      .select("category, attempts")
      .eq("scope", scope)
      .eq("subject", subject);
    if (error) throw error;
    return new Map((data ?? []).map((row) => [row.category as string, (row.attempts as number) ?? 0]));
  } catch (err) {
    console.error(`Recherche-Versuche konnten nicht gelesen werden (${scope}/${subject}):`, err);
    return new Map();
  }
}

/**
 * Filtert die noch fehlenden Themen auf die, die die Automatik überhaupt noch
 * anfassen darf (siehe MAX_AUTO_ATTEMPTS). Die aussortierten Themen bleiben
 * als offene Lücke stehen und warten auf Redaktion oder einen bewussten
 * Admin-Klick.
 */
export function withinAttemptLimit(missing: string[], attempts: Map<string, number>): string[] {
  return missing.filter((category) => (attempts.get(category) ?? 0) < MAX_AUTO_ATTEMPTS);
}

/**
 * Vermerkt einen tatsächlich erfolgten Recherche-Versuch für die genannten
 * Themen - unabhängig davon, ob er etwas geliefert hat. Genau dieser Vermerk
 * hat vorher gefehlt: ohne ihn galt ein Thema, für das die Recherche nichts
 * zurückgab, dauerhaft als "noch nie versucht".
 */
export async function markAttempted(params: {
  scope: GapScope;
  subject: string;
  categories: string[];
  shipName?: string | null;
  tripId?: string | null;
}): Promise<void> {
  const { scope, subject, categories } = params;
  if (categories.length === 0) return;

  // Sicherstellen, dass es überhaupt eine Zeile gibt, die den Versuch tragen
  // kann - beim ersten Lauf für einen neuen Hafen existiert sie noch nicht.
  await recordGaps(params);

  try {
    const supabase = adminClient();
    const now = new Date().toISOString();
    const { data, error: readError } = await supabase
      .from("research_gaps")
      .select("id, attempts")
      .eq("scope", scope)
      .eq("subject", subject)
      .in("category", categories);
    if (readError) throw readError;

    for (const row of data ?? []) {
      const { error } = await supabase
        .from("research_gaps")
        .update({ attempts: ((row.attempts as number) ?? 0) + 1, last_attempt_at: now })
        .eq("id", row.id);
      if (error) throw error;
    }
  } catch (err) {
    console.error(`Recherche-Versuch konnte nicht vermerkt werden (${scope}/${subject}):`, err);
  }
}

/**
 * Schließt Lücken, die inzwischen gefüllt sind. Zeilen bleiben erhalten (nur
 * resolved_at wird gesetzt), damit nachvollziehbar bleibt, was wie lange
 * gefehlt hat und wie viele Versuche es gekostet hat.
 */
export async function resolveGaps(scope: GapScope, subject: string, categories: string[]): Promise<void> {
  if (categories.length === 0) return;
  try {
    const supabase = adminClient();
    const { error } = await supabase
      .from("research_gaps")
      .update({ resolved_at: new Date().toISOString() })
      .eq("scope", scope)
      .eq("subject", subject)
      .in("category", categories)
      .is("resolved_at", null);
    if (error) throw error;
  } catch (err) {
    console.error(`Recherche-Lücke konnte nicht geschlossen werden (${scope}/${subject}):`, err);
  }
}

/**
 * Alle offenen Lücken für den Admin-Bereich, am häufigsten gebrauchte zuerst.
 */
export async function listOpenGaps(limit = 100): Promise<ResearchGap[]> {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("research_gaps")
      .select("*")
      .is("resolved_at", null)
      .order("seen_count", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ResearchGap[];
  } catch (err) {
    console.error("Recherche-Lücken konnten nicht geladen werden:", err);
    return [];
  }
}
