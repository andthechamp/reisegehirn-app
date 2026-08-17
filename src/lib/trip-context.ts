import type { getSupabaseServerClient } from "@/lib/supabase";
import type { SightItem } from "@/lib/research-schema";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

export interface TripContext {
  trip: {
    id: string;
    ship_name: string;
    route_name: string | null;
    start_date: string;
    end_date: string;
    start_port: string | null;
    end_port: string | null;
    status: string;
    owner_id: string | null;
  };
  bookings: Array<{
    id: string;
    cabin_number: string | null;
    cabin_type: string | null;
    price_total: number | null;
    currency: string | null;
    tariff: string | null;
    booking_reference: string | null;
  }>;
  travelers: Array<{
    id: string;
    name: string;
    age_at_trip: number | null;
    cabin_number: string | null; // aus booking_id aufgelöst, für lesbaren Kontext
  }>;
  port_calls: Array<{
    id: string;
    day_number: number;
    call_date: string;
    port_name: string;
    arrival_time: string | null;
    departure_time: string | null;
    is_sea_day: boolean;
    confidence: string;
  }>;
  research: Array<{
    id: string;
    port_call_id: string | null; // null = reiseübergreifend (z. B. Schiffswissen)
    category: string;
    title: string;
    content: string;
    // Nur bei category "sehenswuerdigkeiten" befüllt (siehe port_research.items).
    items: SightItem[] | null;
    source_tier: string;
    source_name: string | null;
    source_url: string | null;
    staleness: string;
  }>;
  memory: Array<{
    id: string;
    content: string;
    source_type: string;
  }>;
  excursions: Array<{
    id: string;
    port_call_id: string;
    title: string;
    provider_type: string;
    meeting_point: string | null;
    meeting_time: string | null;
    price_total: number | null;
    currency: string | null;
    booking_reference: string | null;
    notes: string | null;
  }>;
}

/**
 * Lädt die "harten Fakten" (Ebene 1) einer Reise für den Chat-Kontext.
 * Gibt null zurück, wenn die Reise nicht existiert.
 */
export async function fetchTripContext(
  supabase: SupabaseServerClient,
  tripId: string
): Promise<TripContext | null> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) return null;

  const [
    { data: bookings, error: bookingsError },
    { data: travelers, error: travelersError },
    { data: portCalls, error: portCallsError },
    { data: research, error: researchError },
    { data: shipResearch, error: shipResearchError },
    { data: memory, error: memoryError },
    { data: excursions, error: excursionsError },
  ] = await Promise.all([
    supabase.from("bookings").select("*").eq("trip_id", tripId),
    supabase.from("travelers").select("*").eq("trip_id", tripId),
    supabase.from("port_calls").select("*").eq("trip_id", tripId).order("day_number", { ascending: true }),
    // schiffswissen/insider_tipps explizit ausschließen: die gehören seit der
    // ship_research-Umstellung nicht mehr hierher. Schutz gegen Altlasten aus
    // Zeiten vor der Migration, die sonst doppelt zu den ship_research-
    // Einträgen angezeigt würden (z. B. der Decksplan zweimal).
    supabase
      .from("research_findings")
      .select("*")
      .eq("trip_id", tripId)
      .not("category", "in", "(schiffswissen,insider_tipps)")
      .order("sort_order", { ascending: true }),
    // Schiffsinfos hängen am Schiffsnamen, nicht an dieser Reise - siehe ship_research.
    supabase.from("ship_research").select("*").eq("ship_name", trip.ship_name).order("sort_order", { ascending: true }),
    supabase.from("user_memory").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("port_excursions").select("*").eq("trip_id", tripId),
  ]);

  if (bookingsError) throw bookingsError;
  if (travelersError) throw travelersError;
  if (portCallsError) throw portCallsError;
  if (researchError) throw researchError;
  if (shipResearchError) throw shipResearchError;
  if (memoryError) throw memoryError;
  if (excursionsError) throw excursionsError;

  const bookingIdToCabinNumber = new Map<string, string | null>();
  for (const b of bookings ?? []) {
    bookingIdToCabinNumber.set(b.id as string, (b.cabin_number as string | null) ?? null);
  }

  // Hafenunabhängiges Wissen (port_research) hängt am Hafennamen, nicht an
  // dieser Reise - siehe port-research.ts. Ein Hafen kann in derselben Reise
  // mehrfach angelaufen werden (z. B. Übernachtung), daher pro passendem
  // port_call einen eigenen Eintrag erzeugen statt nur einen pro Hafenname.
  const portNameToCallIds = new Map<string, string[]>();
  for (const pc of portCalls ?? []) {
    if (pc.is_sea_day) continue;
    const list = portNameToCallIds.get(pc.port_name as string) ?? [];
    list.push(pc.id as string);
    portNameToCallIds.set(pc.port_name as string, list);
  }
  const portNames = [...portNameToCallIds.keys()];

  const { data: portResearch, error: portResearchError } =
    portNames.length > 0
      ? await supabase
          .from("port_research")
          .select("*")
          .in("port_name", portNames)
          .order("sort_order", { ascending: true })
      : { data: [] as Record<string, unknown>[], error: null };
  if (portResearchError) throw portResearchError;

  const portResearchExpanded = (portResearch ?? []).flatMap((r) => {
    const callIds = portNameToCallIds.get(r.port_name as string) ?? [];
    return callIds.map((callId) => ({
      id: r.id as string,
      port_call_id: callId,
      category: r.category,
      title: r.title,
      content: r.content,
      items: (r.items as SightItem[] | null) ?? null,
      source_tier: r.source_tier,
      source_name: r.source_name,
      source_url: r.source_url,
      staleness: r.staleness,
    }));
  });

  return {
    trip: {
      id: trip.id,
      ship_name: trip.ship_name,
      route_name: trip.route_name,
      start_date: trip.start_date,
      end_date: trip.end_date,
      start_port: trip.start_port,
      end_port: trip.end_port,
      status: trip.status,
      owner_id: trip.owner_id,
    },
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      cabin_number: b.cabin_number,
      cabin_type: b.cabin_type,
      price_total: b.price_total,
      currency: b.currency,
      tariff: b.tariff,
      booking_reference: b.booking_reference,
    })),
    travelers: (travelers ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      age_at_trip: t.age_at_trip,
      cabin_number: t.booking_id ? bookingIdToCabinNumber.get(t.booking_id as string) ?? null : null,
    })),
    port_calls: (portCalls ?? []).map((pc) => ({
      id: pc.id,
      day_number: pc.day_number,
      call_date: pc.call_date,
      port_name: pc.port_name,
      arrival_time: pc.arrival_time,
      departure_time: pc.departure_time,
      is_sea_day: pc.is_sea_day,
      confidence: pc.confidence,
    })),
    research: [
      ...(shipResearch ?? []).map((r) => ({
        id: r.id,
        port_call_id: null,
        category: r.category,
        title: r.title,
        content: r.content,
        items: null,
        source_tier: r.source_tier,
        source_name: r.source_name,
        source_url: r.source_url,
        staleness: r.staleness,
      })),
      ...(research ?? []).map((r) => ({
        id: r.id,
        port_call_id: r.port_call_id,
        category: r.category,
        title: r.title,
        content: r.content,
        items: null,
        source_tier: r.source_tier,
        source_name: r.source_name,
        source_url: r.source_url,
        staleness: r.staleness,
      })),
      ...portResearchExpanded,
    ],
    memory: (memory ?? []).map((m) => ({
      id: m.id,
      content: m.content,
      source_type: m.source_type,
    })),
    excursions: (excursions ?? []).map((e) => ({
      id: e.id,
      port_call_id: e.port_call_id,
      title: e.title,
      provider_type: e.provider_type,
      meeting_point: e.meeting_point,
      meeting_time: e.meeting_time,
      price_total: e.price_total,
      currency: e.currency,
      booking_reference: e.booking_reference,
      notes: e.notes,
    })),
  };
}

export function serializeTripContext(context: TripContext): string {
  return JSON.stringify(context, null, 2);
}
