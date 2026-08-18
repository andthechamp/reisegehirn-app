import { NextRequest, NextResponse } from "next/server";
import { researchAndSaveCabin } from "@/lib/ship-research";
import { getSupabaseServerClient, requireAdmin } from "@/lib/supabase";
import { normalizeCabinCategory } from "@/lib/cabin";

export const runtime = "nodejs";
// Mehrstufige Recherche mit mehreren Suchrunden kann eine Weile dauern -
// großzügiger bemessen als die einfache Extraktion.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    // Fehlende/veraltete Kabineninfos werden seit der Umstellung auf
    // automatische Recherche (siehe ensureCabinResearched, aufgerufen beim
    // Laden einer Reise) im Hintergrund für alle Nutzer:innen nachgeladen -
    // dieser Endpunkt (manueller Trigger, u.a. "Erneut recherchieren") bleibt
    // Admins vorbehalten, damit nicht jede/r Kreuzfahrtgast beliebig oft
    // kostenpflichtige Anthropic-Aufrufe auslösen kann.
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    }

    const { trip_id, cabin_category, force } = (await req.json()) as {
      trip_id?: string;
      cabin_category?: string;
      force?: boolean;
    };
    if (!trip_id || !cabin_category) {
      return NextResponse.json({ error: "trip_id und cabin_category sind erforderlich." }, { status: 400 });
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

    // cabin_category kommt vom Client bereits als fertiges Label (Kategorie,
    // ggf. "Kategorie · Deck N" - siehe cabinLabel() in src/lib/cabin.ts).
    // normalizeCabinCategory hier nur als defensive Absicherung, falls doch
    // mal ein roher cabin_type-Wert mit Klammern/Kommas ankommt.
    const normalizedLabel = normalizeCabinCategory(cabin_category);

    // Kabineninfos sind nicht reisespezifisch, sondern an Schiff+Kategorie(+Deck)
    // gebunden - vor einer neuen Recherche erst prüfen, ob eine andere Reise
    // mit derselben Kombination schon recherchiert hat. Nur bei explizitem
    // "Erneut recherchieren" (force) wird das übersprungen.
    if (!force) {
      const { data: cached, error: cacheError } = await supabase
        .from("ship_research")
        .select("*")
        .eq("ship_name", trip.ship_name)
        .eq("cabin_category", normalizedLabel)
        .order("sort_order", { ascending: true });
      if (cacheError) throw cacheError;
      if (cached && cached.length > 0) {
        return NextResponse.json({ findings: cached, cached: true });
      }
    }

    const result = await researchAndSaveCabin(supabase, trip.ship_name, normalizedLabel);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Recherche fehlgeschlagen: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ findings: result.findings, cached: false });
  } catch (err) {
    console.error("Kabinenrecherche fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
