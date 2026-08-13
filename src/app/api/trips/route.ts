import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Ohne dieses Flag erkennt Next.js die Route als statisch (kein dynamischer
// Input wie params/cookies) und würde die Reiseliste beim Produktions-Build
// einfrieren, statt sie bei jedem Aufruf frisch aus Supabase zu laden.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data: trips, error } = await supabase
      .from("trips")
      .select("id, ship_name, route_name, start_date, end_date")
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ trips: trips ?? [] });
  } catch (err) {
    console.error("Laden der Reiseliste fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Laden fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
