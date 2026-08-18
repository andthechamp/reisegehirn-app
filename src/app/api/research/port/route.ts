import { NextRequest, NextResponse } from "next/server";
import { researchAndSavePort, PORT_RESEARCH_CACHE_MAX_AGE_DAYS } from "@/lib/port-research";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Mehrstufige Recherche mit mehreren Suchrunden kann eine Weile dauern -
// großzügiger bemessen als die einfache Extraktion.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, port_call_id, force } = (await req.json()) as {
      trip_id?: string;
      port_call_id?: string;
      force?: boolean;
    };
    if (!trip_id || !port_call_id) {
      return NextResponse.json({ error: "trip_id und port_call_id sind erforderlich." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const [{ data: trip, error: tripError }, { data: portCall, error: portCallError }] = await Promise.all([
      supabase.from("trips").select("id, ship_name").eq("id", trip_id).single(),
      supabase.from("port_calls").select("id, port_name, call_date, is_sea_day").eq("id", port_call_id).single(),
    ]);
    if (tripError || !trip) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }
    if (portCallError || !portCall) {
      return NextResponse.json({ error: "Hafenanlauf nicht gefunden." }, { status: 404 });
    }
    if (portCall.is_sea_day) {
      return NextResponse.json({ error: "An einem Seetag gibt es keinen Hafen zu recherchieren." }, { status: 400 });
    }

    // Hafenunabhängiges Wissen (port_research) ist über alle Reisen hinweg
    // geteilt - vor einer neuen Recherche erst prüfen, ob eine andere Reise
    // denselben Hafen innerhalb der letzten 7 Tage schon recherchiert hat.
    // Nur bei explizitem "Erneut recherchieren" (force) wird das übersprungen.
    if (!force) {
      const cutoff = new Date(Date.now() - PORT_RESEARCH_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: cachedPort, error: cachedPortError } = await supabase
        .from("port_research")
        .select("*")
        .eq("port_name", portCall.port_name)
        .order("sort_order", { ascending: true });
      if (cachedPortError) throw cachedPortError;

      // Kuratierte Zeilen (curated = true) unterliegen keiner Alters-Prüfung
      // und dürfen daher allein keinen Cache-Treffer vortäuschen - siehe
      // ensurePortResearched in lib/port-research.ts für dieselbe Logik.
      const hasFreshAiRow = (cachedPort ?? []).some(
        (r) => r.curated !== true && typeof r.retrieved_at === "string" && r.retrieved_at >= cutoff
      );

      if (hasFreshAiRow && cachedPort) {
        // Reederei-/private Ausflüge sind trip-spezifisch (research_findings) -
        // die gibt's nur, wenn genau diese Reise diesen Hafen schon einmal
        // recherchiert hat. Ein Cache-Treffer bei port_research liefert daher
        // zunächst nur das geteilte Hafenwissen; für Ausflüge hilft "Erneut
        // recherchieren".
        const { data: cachedTrip, error: cachedTripError } = await supabase
          .from("research_findings")
          .select("*")
          .eq("trip_id", trip_id)
          .eq("port_call_id", port_call_id)
          .order("sort_order", { ascending: true });
        if (cachedTripError) throw cachedTripError;

        const merged = [
          ...cachedPort.map((r) => ({ ...r, port_call_id })),
          ...(cachedTrip ?? []),
        ];
        return NextResponse.json({ findings: merged, cached: true });
      }
    }

    const result = await researchAndSavePort(supabase, {
      tripId: trip_id,
      portCallId: port_call_id,
      shipName: trip.ship_name,
      portName: portCall.port_name,
      callDate: portCall.call_date,
    });
    if (!result.ok) {
      return NextResponse.json({ error: `Recherche fehlgeschlagen: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ findings: result.findings, cached: false });
  } catch (err) {
    console.error("Hafenrecherche fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
