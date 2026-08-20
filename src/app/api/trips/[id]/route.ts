import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase";
import { fetchTripContext, type TripContext } from "@/lib/trip-context";
import { ensureShipResearched, ensureCabinResearched } from "@/lib/ship-research";
import { ensurePortResearched } from "@/lib/port-research";
import { ensurePortCoordinates } from "@/lib/port-coordinates";
import { ensureShipPhoto, ensurePortPhotos } from "@/lib/ship-photos";
import { normalizeCabinCategory, extractDeckNumber, cabinLabel } from "@/lib/cabin";
import type { ExtractionResult } from "@/lib/extraction-schema";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

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

// Leitet aus den Buchungen die zu recherchierenden Kabinenkategorie-Labels
// ab (Kategorie, ggf. "Kategorie · Deck N") - dieselbe Gruppierung wie im
// Frontend (siehe trips/[id]/page.tsx), hier serverseitig für den
// automatischen Recherche-Anstoß unten.
function distinctCabinLabels(bookings: TripContext["bookings"]): string[] {
  const labels = new Set<string>();
  for (const b of bookings) {
    if (!b.cabin_type) continue;
    const category = normalizeCabinCategory(b.cabin_type);
    if (!category) continue;
    const deck = b.cabin_number ? extractDeckNumber(b.cabin_number) : null;
    labels.add(cabinLabel(category, deck));
  }
  return [...labels];
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await getSupabaseServerClient();

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isOwner = context.trip.owner_id === user?.id;

    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      isAdmin = profile?.role === "admin";
    }

    // Nutzer:innen können Recherche nicht mehr manuell anstoßen (siehe
    // /api/research/ship|port|cabin, jetzt admin-only) - stattdessen prüft
    // jedes Laden einer Reise selbst, was fehlt oder veraltet ist, und holt
    // es im Hintergrund nach. ensureShipResearched/ensureCabinResearched/
    // ensurePortResearched machen dabei selbst nur dann einen (kostenpflich-
    // tigen) Anthropic-Aufruf, wenn kein aktueller Cache-Treffer existiert -
    // ein Laden ohne Rückstand kostet also nur ein paar zusätzliche
    // DB-Lesezugriffe. Läuft nach der Response weiter (after()) und nutzt
    // daher den Admin-Client, da der request-gebundene Client nach dem
    // Response-Flush nicht mehr zuverlässig nutzbar ist (gleiches Muster wie
    // /api/confirm). Sequenziell, um die Anthropic-API nicht mit parallelen
    // Suchrunden für dieselbe Reise zu überlasten.
    const shipName = context.trip.ship_name;
    const cabinLabels = distinctCabinLabels(context.bookings);
    const portsToCheck = context.port_calls.filter((pc) => !pc.is_sea_day);

    // Koordinaten fürs Kartenbild (RouteMap.tsx) - anders als die
    // Websuche-Recherche unten bewusst NICHT über after() im Hintergrund,
    // sondern blockierend: Geocoding kostet keinen Anthropic-Aufruf, nur
    // einen schnellen Nominatim-Request pro noch unbekanntem Hafen (danach
    // für immer gecacht, siehe port-coordinates.ts), und ohne Koordinaten
    // kann die Karte beim ersten Laden einer neuen Reise gar nichts anzeigen.
    const coordinates = await ensurePortCoordinates(
      supabase,
      portsToCheck.map((pc) => pc.port_name)
    );

    // Hero-Foto für die Reiseseite (TripHero) und Hafenfotos für die
    // Tageskarten (PortDaySwiper): dauerhaft in place_photos gecacht (siehe
    // ensureShipPhoto/ensurePortPhotos in lib/ship-photos.ts), sonst würde
    // jeder Ladevorgang Wikipedia/Commons erneut abfragen und deren
    // Rate-Limit reißen. Kostenlose Bildsuche ohne Anthropic-Aufruf, daher
    // blockierend okay - wie ensurePortCoordinates oben.
    const shipPhoto = await ensureShipPhoto(supabase, shipName);

    const uniquePortNames = [...new Set(portsToCheck.map((pc) => pc.port_name))];
    const portPhotoMap = await ensurePortPhotos(supabase, uniquePortNames);
    const portPhotos = Object.fromEntries(
      [...portPhotoMap].filter(([, photo]) => photo.url !== null).map(([name, photo]) => [name, photo.url as string])
    );
    const portPhotoAttributions = Object.fromEntries(
      [...portPhotoMap].filter(([, photo]) => photo.attribution).map(([name, photo]) => [name, photo.attribution as string])
    );

    after(async () => {
      const adminSupabase = getSupabaseAdminClient();
      try {
        await ensureShipResearched(adminSupabase, shipName);
      } catch (err) {
        console.error(`Automatische Schiffsrecherche fehlgeschlagen (${shipName}):`, err);
      }
      for (const label of cabinLabels) {
        try {
          await ensureCabinResearched(adminSupabase, shipName, label);
        } catch (err) {
          console.error(`Automatische Kabinenrecherche fehlgeschlagen (${shipName} / ${label}):`, err);
        }
      }
      for (const pc of portsToCheck) {
        try {
          await ensurePortResearched(adminSupabase, {
            tripId: params.id,
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

    return NextResponse.json({
      context,
      messages: messages ?? [],
      isOwner,
      isAdmin,
      portCoordinates: Object.fromEntries(coordinates),
      shipImageUrl: shipPhoto?.url ?? null,
      shipImageAttribution: shipPhoto?.attribution ?? null,
      portPhotos,
      portPhotoAttributions,
    });
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

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await getSupabaseServerClient();
    // RLS ("trips: delete if owner") lässt das Löschen ohnehin nur durch den
    // Besitzer zu; Buchungen/Reisende/Hafenanläufe/Recherche-Funde/Ausflüge
    // hängen per "on delete cascade" an trips und werden automatisch mit
    // entfernt. Geteiltes Wissen (ship_research/port_research) ist bewusst
    // NICHT an trip_id gebunden und bleibt für andere Reisen erhalten.
    const { error, count } = await supabase.from("trips").delete({ count: "exact" }).eq("id", params.id);
    if (error) throw error;
    if (count === 0) {
      return NextResponse.json(
        { error: "Reise nicht gefunden oder keine Berechtigung zum Löschen." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reise löschen fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Löschen fehlgeschlagen: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const data = (await req.json()) as ExtractionResult;
    const tripId = params.id;
    const supabase = await getSupabaseServerClient();

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
