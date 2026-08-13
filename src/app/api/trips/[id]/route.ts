import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchTripContext } from "@/lib/trip-context";
import type { ExtractionResult } from "@/lib/extraction-schema";

type SupabaseServerClient = ReturnType<typeof getSupabaseServerClient>;

/**
 * Gleicht eine Sammlung (Kabinen/Hafenanläufe/Reisende) mit der DB ab, statt
 * beim Bearbeiten alles zu löschen und neu anzulegen: Zeilen mit id werden
 * upgedatet (behalten ihre id), Zeilen ohne id werden neu angelegt, DB-Zeilen,
 * die im Submit fehlen, werden gelöscht. Wichtig, damit z. B. Recherche-
 * Ergebnisse zu einem unveränderten Hafen beim Bearbeiten erhalten bleiben
 * (die hängen per Foreign Key an der port_calls-id).
 */
async function syncCollection<T extends { id?: string }>(
  supabase: SupabaseServerClient,
  table: "bookings" | "port_calls" | "travelers",
  tripId: string,
  submitted: T[],
  toRow: (item: T) => Record<string, unknown>
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id")
    .eq("trip_id", tripId);
  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const submittedIds = new Set(submitted.filter((s) => s.id).map((s) => s.id as string));
  const idsToDelete = [...existingIds].filter((id) => !submittedIds.has(id));

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", idsToDelete);
    if (error) throw error;
  }

  const results: Array<Record<string, unknown> & { id: string }> = [];

  for (const item of submitted.filter((s) => s.id)) {
    const { data, error } = await supabase
      .from(table)
      .update(toRow(item))
      .eq("id", item.id as string)
      .select()
      .single();
    if (error) throw error;
    results.push(data);
  }

  const toInsert = submitted.filter((s) => !s.id);
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from(table)
      .insert(toInsert.map(toRow))
      .select();
    if (error) throw error;
    results.push(...(data ?? []));
  }

  return results;
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = getSupabaseServerClient();

    const context = await fetchTripContext(supabase, params.id);
    if (!context) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("trip_id", params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ context, messages: messages ?? [] });
  } catch (err) {
    console.error("Laden der Reise fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Laden fehlgeschlagen: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const data = (await req.json()) as ExtractionResult;
    const tripId = params.id;
    const supabase = getSupabaseServerClient();

    // 1. Reise selbst aktualisieren
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .update({
        ship_name: data.trip.ship_name,
        route_name: data.trip.route_name,
        start_date: data.trip.start_date,
        end_date: data.trip.end_date,
        start_port: data.trip.start_port,
        end_port: data.trip.end_port,
      })
      .eq("id", tripId)
      .select()
      .single();
    if (tripError || !trip) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }

    // 2. Buchungen (Kabinen) abgleichen. cabin_number -> booking_id merken,
    //    um Reisende weiter unten ihrer (ggf. neuen) Kabine zuzuordnen.
    const bookingRows = await syncCollection(supabase, "bookings", tripId, data.bookings ?? [], (b) => ({
      trip_id: tripId,
      cabin_number: b.cabin_number,
      cabin_type: b.cabin_type,
      price_total: b.price_total,
      currency: b.currency ?? "EUR",
      tariff: b.tariff,
      booking_reference: b.booking_reference,
    }));
    const cabinNumberToBookingId = new Map<string, string>();
    for (const booking of bookingRows) {
      if (booking.cabin_number) {
        cabinNumberToBookingId.set(booking.cabin_number as string, booking.id);
      }
    }

    // 3. Hafenanläufe abgleichen - unveränderte Häfen behalten ihre id und
    //    damit ihre bereits recherchierten research_findings/port_excursions.
    await syncCollection(supabase, "port_calls", tripId, data.port_calls ?? [], (pc) => ({
      trip_id: tripId,
      day_number: pc.day_number,
      call_date: pc.call_date,
      port_name: pc.port_name,
      arrival_time: pc.arrival_time,
      departure_time: pc.departure_time,
      is_sea_day: pc.is_sea_day,
      confidence: pc.arrival_time && pc.departure_time ? "bestätigt" : "unbekannt",
    }));

    // 4. Mitreisende abgleichen
    await syncCollection(supabase, "travelers", tripId, data.travelers ?? [], (t) => ({
      trip_id: tripId,
      booking_id: t.cabin_number ? cabinNumberToBookingId.get(t.cabin_number) ?? null : null,
      name: t.name,
      age_at_trip: t.age_at_trip,
    }));

    return NextResponse.json({ trip_id: tripId });
  } catch (err) {
    console.error("Bearbeiten fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Bearbeiten fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
