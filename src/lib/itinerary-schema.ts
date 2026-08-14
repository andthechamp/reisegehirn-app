// Leichtgewichtiges Gegenstück zu ExtractionResult (extraction-schema.ts) -
// für Dokumente, die nur den Reiseverlauf zeigen (z. B. ein Screenshot der
// Reederei-App), ohne Schiffsname/Buchungszeitraum. Deshalb kein Pflichtfeld
// "trip", nur die Hafentage.

export interface ExtractedItineraryDay {
  day_number: number;
  call_date: string | null; // YYYY-MM-DD, falls im Dokument erkennbar
  port_name: string | null;
  arrival_time: string | null; // HH:MM, NIE geraten
  departure_time: string | null; // HH:MM, NIE geraten
  is_sea_day: boolean;
}

export function parseExtractedItinerary(raw: string): ExtractedItineraryDay[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Konnte Reiseverlauf-Extraktion nicht als JSON parsen. Rohantwort:", raw);
    throw new Error(
      "Die Modellantwort war kein gültiges JSON. Bitte Foto erneut hochladen oder ein schärferes Bild versuchen."
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Im Dokument konnte kein Reiseverlauf (Tage/Häfen) erkannt werden.");
  }

  return (parsed as Partial<ExtractedItineraryDay>[]).map((d, i) => ({
    day_number: typeof d.day_number === "number" ? d.day_number : i + 1,
    call_date: d.call_date ?? null,
    port_name: d.port_name ?? null,
    arrival_time: d.arrival_time ?? null,
    departure_time: d.departure_time ?? null,
    is_sea_day: d.is_sea_day === true,
  }));
}
