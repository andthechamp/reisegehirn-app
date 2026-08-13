import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

interface CreateExcursionBody {
  trip_id?: string;
  port_call_id?: string;
  title?: string;
  provider_type?: "reederei" | "privat";
  meeting_point?: string | null;
  meeting_time?: string | null;
  price_total?: number | null;
  currency?: string | null;
  booking_reference?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateExcursionBody;
    if (!body.trip_id || !body.port_call_id || !body.title?.trim()) {
      return NextResponse.json(
        { error: "trip_id, port_call_id und title sind erforderlich." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: inserted, error } = await supabase
      .from("port_excursions")
      .insert({
        trip_id: body.trip_id,
        port_call_id: body.port_call_id,
        title: body.title,
        provider_type: body.provider_type ?? "privat",
        meeting_point: body.meeting_point || null,
        meeting_time: body.meeting_time || null,
        price_total: body.price_total ?? null,
        currency: body.currency || "EUR",
        booking_reference: body.booking_reference || null,
        notes: body.notes || null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ excursion: inserted });
  } catch (err) {
    console.error("Ausflug anlegen fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Anlegen fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
