import { NextRequest, NextResponse } from "next/server";
import { researchAndSaveShip, researchAndSaveCabin } from "@/lib/ship-research";
import { computeCacheTtlDays } from "@/lib/research-schema";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Läuft ggf. mehrere Schiffe nacheinander durch - großzügig bemessen.
export const maxDuration = 300;

// Temporär pausiert: der automatische Refresh hat zuletzt zu viele Tokens
// verbrannt, ohne verwertbare Ergebnisse zu liefern (siehe RESEARCH_MODEL-
// Wechsel auf Sonnet in anthropic.ts). Bestehende Daten bleiben unangetastet,
// bis das hier wieder auf true gesetzt wird.
const CRON_REFRESH_ENABLED = false;

/**
 * Täglich per Vercel Cron aufgerufen (siehe vercel.json). Sucht selbst nur
 * Schiffe/Kabinenkategorien, deren gecachter Fundsatz laut computeCacheTtlDays
 * (gestaffelt nach der volatilsten enthaltenen Staleness-Einstufung) fällig
 * ist - ein rein "zeitloser" Satz (z. B. nur Decksplan-Fakten) wird so seltener
 * neu recherchiert als einer mit "verfällt"-Anteilen. So holt ein verpasster
 * Lauf (Deploy, Ausfall) den Rückstand beim nächsten Tick von selbst nach,
 * statt starr im immer gleichen Takt feuern zu müssen.
 */
export async function GET(req: NextRequest) {
  if (!CRON_REFRESH_ENABLED) {
    return NextResponse.json({ skipped: "Cron-Refresh ist aktuell pausiert." });
  }

  // Fail-closed: ohne gesetztes CRON_SECRET ist der Endpunkt sonst öffentlich
  // aufrufbar (läuft über den Admin-Client, der RLS umgeht, und löst
  // kostenpflichtige Anthropic-Aufrufe aus) - eine fehlende Env-Variable
  // darf daher nie als "keine Prüfung nötig" interpretiert werden.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Ship-Research-Refresh: CRON_SECRET ist nicht gesetzt, Aufruf wird abgelehnt.");
    return NextResponse.json({ error: "Server nicht korrekt konfiguriert." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("ship_research")
    .select("ship_name, cabin_category, staleness, retrieved_at")
    .order("retrieved_at", { ascending: true });
  if (error) {
    console.error("Ship-Research-Refresh: Konnte bestehende Schiffe nicht laden:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Neuestes retrieved_at UND alle Staleness-Werte je Schiff+Kabinenkategorie-
  // Kombination sammeln (null-Kategorie = allgemeine Schiffsinfos) - getrennt
  // gezählt, da eine frische Kabinenrecherche einen veralteten allgemeinen
  // Schiffseintrag nicht "mitfrischt" und umgekehrt. Die TTL pro Kombination
  // ergibt sich aus computeCacheTtlDays über alle ihre Staleness-Werte.
  const latestByKey = new Map<
    string,
    { shipName: string; cabinCategory: string | null; retrievedAt: string; stalenessValues: string[] }
  >();
  for (const row of rows ?? []) {
    const key = `${row.ship_name} ${row.cabin_category ?? ""}`;
    const current = latestByKey.get(key);
    if (!current) {
      latestByKey.set(key, {
        shipName: row.ship_name,
        cabinCategory: row.cabin_category,
        retrievedAt: row.retrieved_at,
        stalenessValues: [row.staleness],
      });
    } else {
      current.stalenessValues.push(row.staleness);
      if (row.retrieved_at > current.retrievedAt) current.retrievedAt = row.retrieved_at;
    }
  }
  const staleEntries = [...latestByKey.values()].filter((entry) => {
    const ttlDays = computeCacheTtlDays(entry.stalenessValues);
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
    return entry.retrievedAt < cutoff;
  });

  const results: Record<string, string> = {};
  for (const entry of staleEntries) {
    const resultKey = entry.cabinCategory ? `${entry.shipName} / ${entry.cabinCategory}` : entry.shipName;
    const result = entry.cabinCategory
      ? await researchAndSaveCabin(supabase, entry.shipName, entry.cabinCategory)
      : await researchAndSaveShip(supabase, entry.shipName);
    results[resultKey] = result.ok ? "ok" : `error: ${result.error}`;
    if (!result.ok) {
      console.error(`Ship-Research-Refresh: ${resultKey} fehlgeschlagen:`, result.error);
    }
  }

  return NextResponse.json({ checked: latestByKey.size, refreshed: staleEntries.length, results });
}
