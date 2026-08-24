import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase";
import { ensurePortResearched } from "@/lib/port-research";
import type { ExtractionResult } from "@/lib/extraction-schema";

export const runtime = "nodejs";
// Nach dem Speichern werden alle Häfen der Reise im Hintergrund recherchiert
// (siehe unten, after()) - mehrere Häfen nacheinander können eine Weile
// dauern, daher großzügig bemessen (analog zum Ship-Research-Cron).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as ExtractionResult;
    const supabase = await getSupabaseServerClient();

    // 1. Reise anlegen (Ebene "Harte Fakten")
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        ship_name: data.trip.ship_name,
        route_name: data.trip.route_name,
        start_date: data.trip.start_date,
        end_date: data.trip.end_date,
        start_port: data.trip.start_port,
        end_port: data.trip.end_port,
        status: "bestätigt",
      })
      .select()
      .single();

    if (tripError || !trip) {
      throw tripError ?? new Error("Reise konnte nicht angelegt werden.");
    }

    const tripId = trip.id as string;

    // 2. Buchungen (eine Zeile pro Kabine) - confirmed_by_user ist hier bewusst
    //    true, weil dieser Endpunkt erst nach der Bestätigungsschleife im
    //    Frontend aufgerufen wird. cabin_number -> booking_id-Zuordnung merken,
    //    um Reisende weiter unten ihrer Kabine zuzuordnen.
    const cabinNumberToBookingId = new Map<string, string>();
    if (data.bookings?.length) {
      const rows = data.bookings.map((b) => ({
        trip_id: tripId,
        cabin_number: b.cabin_number,
        cabin_type: b.cabin_type,
        price_total: b.price_total,
        currency: b.currency ?? "EUR",
        tariff: b.tariff,
        booking_reference: b.booking_reference,
        confirmed_by_user: true,
        confirmed_at: new Date().toISOString(),
      }));
      const { data: insertedBookings, error } = await supabase
        .from("bookings")
        .insert(rows)
        .select();
      if (error) throw error;
      for (const booking of insertedBookings ?? []) {
        if (booking.cabin_number) {
          cabinNumberToBookingId.set(booking.cabin_number as string, booking.id as string);
        }
      }
    }

    // 3. Hafenanläufe - confidence spiegelt Regel 3.2 aus dem Konzeptdokument:
    //    nur 'bestätigt', wenn beide Zeiten tatsächlich vorliegen.
    let portsToResearch: { id: string; port_name: string; call_date: string }[] = [];
    if (data.port_calls?.length) {
      const rows = data.port_calls.map((pc) => ({
        trip_id: tripId,
        day_number: pc.day_number,
        call_date: pc.call_date,
        port_name: pc.port_name?.trim() || (pc.is_sea_day ? "Seetag" : "Unbekannter Hafen"),
        arrival_time: pc.arrival_time,
        departure_time: pc.departure_time,
        is_sea_day: pc.is_sea_day,
        confidence: pc.arrival_time && pc.departure_time ? "bestätigt" : "unbekannt",
        source: "Foto-Upload durch Nutzer",
      }));
      const { data: insertedPortCalls, error } = await supabase.from("port_calls").insert(rows).select();
      if (error) throw error;
      portsToResearch = (insertedPortCalls ?? []).filter((pc) => !pc.is_sea_day);
    }

    // 4. Mitreisende - jeweils der passenden Kabine zugeordnet, falls cabin_number
    //    mit einer der oben angelegten Buchungen übereinstimmt.
    if (data.travelers?.length) {
      const rows = data.travelers.map((t) => ({
        trip_id: tripId,
        booking_id: t.cabin_number ? cabinNumberToBookingId.get(t.cabin_number) ?? null : null,
        name: t.name,
        age_at_trip: t.age_at_trip,
      }));
      const { error } = await supabase.from("travelers").insert(rows);
      if (error) throw error;
    }

    // Direkt nach dem erfolgreichen Hochladen alle Häfen der Reise auf
    // vorhandenes Wissen prüfen. Mit RESEARCH_AUTO = false (lib/anthropic.ts)
    // wird dabei nichts kostenpflichtig nachrecherchiert - die fehlenden
    // Themen werden protokolliert (research_gaps), damit sie im Admin-Bereich
    // sichtbar sind und gefüllt werden können, bevor jemand die Reise öffnet.
    // Wetterdaten und Hafenbilder kommen weiterhin sofort, die kosten nichts.
    // Erst hier registriert (nach allen Inserts), damit bei einem
    // späteren Fehler (z.B. Mitreisende) keine Recherche für eine Reise
    // läuft, deren Speichern dem Nutzer als fehlgeschlagen gemeldet wird.
    // Läuft nach der Response weiter (after()) und nutzt daher den
    // Admin-Client, da der request-gebundene Client nach dem Response-Flush
    // nicht mehr zuverlässig nutzbar ist. Sequenziell, um die Anthropic-API
    // nicht mit parallelen Suchrunden für dieselbe Reise zu überlasten.
    if (portsToResearch.length > 0) {
      const shipName = data.trip.ship_name;
      after(async () => {
        const adminSupabase = getSupabaseAdminClient();
        for (const pc of portsToResearch) {
          try {
            await ensurePortResearched(adminSupabase, {
              tripId,
              portCallId: pc.id,
              shipName,
              portName: pc.port_name,
              callDate: pc.call_date,
            });
          } catch (err) {
            console.error(`Automatische Hafenrecherche fehlgeschlagen (${pc.port_name}):`, err);
          }
        }
      });
    }

    return NextResponse.json({ trip_id: tripId });
  } catch (err) {
    console.error("Speichern fehlgeschlagen:", err);
    // Supabase-Fehler sind keine Error-Instanzen, sondern Objekte mit .message
    // (PostgrestError: { message, details, hint, code }) - beides abdecken,
    // sonst geht die eigentliche Fehlerursache in "Unbekannter Fehler" verloren.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json(
      { error: `Speichern fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
