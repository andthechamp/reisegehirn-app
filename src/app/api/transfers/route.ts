import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

interface CreateTransferBody {
  trip_id?: string;
  direction?: "anreise" | "abreise";
  transfer_art?: "auto" | "flug";
  date?: string | null;
  parkplatz_anbieter?: string | null;
  parkplatz_buchungslink?: string | null;
  reservierungsnummer?: string | null;
  flugnummer?: string | null;
  airline?: string | null;
  abflugzeit?: string | null;
  ankunftszeit?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateTransferBody;
    if (!body.trip_id || !body.direction || !body.transfer_art) {
      return NextResponse.json(
        { error: "trip_id, direction und transfer_art sind erforderlich." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: inserted, error } = await supabase
      .from("trip_transfers")
      .insert({
        trip_id: body.trip_id,
        direction: body.direction,
        transfer_art: body.transfer_art,
        date: body.date || null,
        parkplatz_anbieter: body.parkplatz_anbieter || null,
        parkplatz_buchungslink: body.parkplatz_buchungslink || null,
        reservierungsnummer: body.reservierungsnummer || null,
        flugnummer: body.flugnummer || null,
        airline: body.airline || null,
        abflugzeit: body.abflugzeit || null,
        ankunftszeit: body.ankunftszeit || null,
        notes: body.notes || null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ transfer: inserted });
  } catch (err) {
    console.error("Transfer anlegen fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Anlegen fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
