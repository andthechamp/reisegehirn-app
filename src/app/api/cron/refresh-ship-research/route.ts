import { NextRequest, NextResponse } from "next/server";
import { researchAndSaveShip } from "@/lib/ship-research";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Läuft ggf. mehrere Schiffe nacheinander durch - großzügig bemessen.
export const maxDuration = 300;

const STALE_AFTER_DAYS = 7;

/**
 * Täglich per Vercel Cron aufgerufen (siehe vercel.json). Sucht selbst nur
 * Schiffe, deren Recherche älter als STALE_AFTER_DAYS ist - so holt ein
 * verpasster Lauf (Deploy, Ausfall) den Rückstand beim nächsten Tick von
 * selbst nach, statt exakt alle 7 Tage feuern zu müssen.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdminClient();

  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("ship_research")
    .select("ship_name, retrieved_at")
    .order("retrieved_at", { ascending: true });
  if (error) {
    console.error("Ship-Research-Refresh: Konnte bestehende Schiffe nicht laden:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Neuestes retrieved_at je Schiffsname ermitteln, dann nur die veralteten behalten.
  const latestByShip = new Map<string, string>();
  for (const row of rows ?? []) {
    const current = latestByShip.get(row.ship_name);
    if (!current || row.retrieved_at > current) {
      latestByShip.set(row.ship_name, row.retrieved_at);
    }
  }
  const staleShipNames = [...latestByShip.entries()]
    .filter(([, retrievedAt]) => retrievedAt < cutoff)
    .map(([shipName]) => shipName);

  const results: Record<string, string> = {};
  for (const shipName of staleShipNames) {
    const result = await researchAndSaveShip(supabase, shipName);
    results[shipName] = result.ok ? "ok" : `error: ${result.error}`;
    if (!result.ok) {
      console.error(`Ship-Research-Refresh: ${shipName} fehlgeschlagen:`, result.error);
    }
  }

  return NextResponse.json({ checked: latestByShip.size, refreshed: staleShipNames.length, results });
}
