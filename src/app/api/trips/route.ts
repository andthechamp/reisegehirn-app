import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Ohne dieses Flag erkennt Next.js die Route als statisch (kein dynamischer
// Input wie params/cookies) und würde die Reiseliste beim Produktions-Build
// einfrieren, statt sie bei jedem Aufruf frisch aus Supabase zu laden.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: trips, error } = await supabase
      .from("trips")
      .select("id, ship_name, route_name, start_date, end_date, owner_id")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const tripsWithOwnership = (trips ?? []).map((t) => ({
      id: t.id,
      ship_name: t.ship_name,
      route_name: t.route_name,
      start_date: t.start_date,
      end_date: t.end_date,
      is_owner: t.owner_id === user?.id,
    }));

    return NextResponse.json({ trips: tripsWithOwnership });
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
