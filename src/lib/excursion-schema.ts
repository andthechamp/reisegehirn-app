// Spiegelt die für die Extraktion relevanten Felder aus port_excursions
// (supabase/schema.sql) - id/trip_id/port_call_id kommen erst beim Speichern
// dazu, nicht aus dem hochgeladenen Dokument.

export interface ExtractedExcursion {
  title: string;
  provider_type: "reederei" | "privat";
  meeting_point: string | null;
  meeting_time: string | null; // HH:MM, NIE geraten
  price_total: number | null;
  currency: string | null;
  booking_reference: string | null;
  notes: string | null;
  // Nur zur automatischen Zuordnung zu einem Hafentag genutzt - werden nicht
  // in port_excursions gespeichert (das übernimmt port_call_id).
  call_date: string | null; // YYYY-MM-DD
  port_name: string | null;
}

export function parseExtractedExcursion(raw: string): ExtractedExcursion {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Konnte Ausflugs-Extraktion nicht als JSON parsen. Rohantwort:", raw);
    throw new Error(
      "Die Modellantwort war kein gültiges JSON. Bitte Foto erneut hochladen oder ein schärferes Bild versuchen."
    );
  }

  const obj = parsed as Partial<ExtractedExcursion>;
  if (!obj.title) {
    throw new Error("Im Dokument konnte kein Ausflugs-Titel erkannt werden.");
  }

  return {
    title: obj.title,
    provider_type: obj.provider_type === "reederei" ? "reederei" : "privat",
    meeting_point: obj.meeting_point ?? null,
    meeting_time: obj.meeting_time ?? null,
    price_total: obj.price_total ?? null,
    currency: obj.currency ?? null,
    booking_reference: obj.booking_reference ?? null,
    notes: obj.notes ?? null,
    call_date: obj.call_date ?? null,
    port_name: obj.port_name ?? null,
  };
}
