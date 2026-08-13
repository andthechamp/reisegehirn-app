// Diese Typen spiegeln absichtlich 1:1 die Tabellen aus supabase/schema.sql,
// damit ein extrahiertes Ergebnis ohne Umformung dort landen kann.

export interface ExtractedTrip {
  ship_name: string;
  route_name: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  start_port: string | null;
  end_port: string | null;
}

// id ist optional: bei einer frischen Extraktion nicht gesetzt (neue Zeile),
// beim Bearbeiten einer gespeicherten Reise gesetzt (bestehende Zeile in der
// DB) - so kann ReviewStep für beide Fälle wiederverwendet werden und das
// PUT-Update in /api/trips/[id] weiß, was aktualisiert statt neu angelegt wird.
export interface ExtractedPortCall {
  id?: string;
  day_number: number;
  call_date: string; // YYYY-MM-DD
  port_name: string;
  arrival_time: string | null; // HH:MM, NIE geraten
  departure_time: string | null; // HH:MM, NIE geraten
  is_sea_day: boolean;
}

// Eine Reise kann mehrere Kabinen umfassen (Familien-/Gruppenreisen) - daher
// ein Array statt einer einzelnen Buchung. ExtractedTraveler.cabin_number
// verweist auf ExtractedBooking.cabin_number, um Reisende ihrer Kabine zuzuordnen.
export interface ExtractedBooking {
  id?: string;
  cabin_number: string | null;
  cabin_type: string | null;
  price_total: number | null;
  currency: string | null;
  tariff: string | null;
  booking_reference: string | null;
}

export interface ExtractedTraveler {
  id?: string;
  name: string;
  age_at_trip: number | null;
  cabin_number: string | null; // muss mit einem ExtractedBooking.cabin_number übereinstimmen
}

export interface ExtractionResult {
  trip: ExtractedTrip;
  port_calls: ExtractedPortCall[];
  bookings: ExtractedBooking[];
  travelers: ExtractedTraveler[];
  extraction_notes: string[];
}

/**
 * Parst und validiert die JSON-Antwort des Modells minimal.
 * Wirft einen verständlichen Fehler, statt stillschweigend mit
 * einer unvollständigen Struktur weiterzuarbeiten - eine fehlerhafte
 * Extraktion soll auffallen, nicht unbemerkt durchrutschen.
 */
export function parseExtractionResult(raw: string): ExtractionResult {
  // Falls das Modell trotz Anweisung Markdown-Codefences mitschickt, entfernen.
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Rohantwort ins Server-Log, damit man beim Debuggen sieht, woran das JSON
    // gescheitert ist (z. B. Abschneiden durch max_tokens) - nie an den Client.
    console.error("Konnte Modellantwort nicht als JSON parsen. Rohantwort:", raw);
    throw new Error(
      "Die Modellantwort war kein gültiges JSON. Bitte Foto erneut hochladen oder ein schärferes Bild versuchen."
    );
  }

  const obj = parsed as Partial<ExtractionResult>;

  if (!obj.trip || !obj.trip.ship_name || !obj.trip.start_date || !obj.trip.end_date) {
    throw new Error(
      "Im Dokument konnten keine grundlegenden Reisedaten (Schiff, Zeitraum) erkannt werden."
    );
  }

  return {
    trip: obj.trip,
    port_calls: Array.isArray(obj.port_calls) ? obj.port_calls : [],
    bookings: Array.isArray(obj.bookings) ? obj.bookings : [],
    travelers: Array.isArray(obj.travelers) ? obj.travelers : [],
    extraction_notes: Array.isArray(obj.extraction_notes) ? obj.extraction_notes : [],
  };
}
