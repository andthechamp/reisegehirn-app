import { NextRequest, NextResponse } from "next/server";
import { researchAndSaveShip } from "@/lib/ship-research";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Mehrstufige Recherche mit mehreren Suchrunden kann eine Weile dauern -
// großzügiger bemessen als die einfache Extraktion.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, force } = (await req.json()) as { trip_id?: string; force?: boolean };
    if (!trip_id) {
      return NextResponse.json({ error: "trip_id ist erforderlich." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, ship_name")
      .eq("id", trip_id)
      .single();
    if (tripError || !trip) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }

    // Schiffsinfos sind nicht reisespezifisch - vor einer neuen Recherche erst
    // prüfen, ob eine andere Reise auf demselben Schiff schon recherchiert hat.
    // Nur bei explizitem "Erneut recherchieren" (force) wird das übersprungen.
    if (!force) {
      const { data: cached, error: cacheError } = await supabase
        .from("ship_research")
        .select("*")
        .eq("ship_name", trip.ship_name)
        .order("sort_order", { ascending: true });
      if (cacheError) throw cacheError;
      if (cached && cached.length > 0) {
        return NextResponse.json({ findings: cached, cached: true });
      }
    }

    const result = await researchAndSaveShip(supabase, trip.ship_name);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Recherche fehlgeschlagen: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ findings: result.findings, cached: false });
  } catch (err) {
    console.error("Schiffsrecherche fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
