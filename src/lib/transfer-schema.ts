// Spiegelt die für die Extraktion relevanten Felder aus trip_transfers
// (supabase/schema.sql) - id/trip_id/direction kommen erst beim Speichern
// dazu, nicht aus dem hochgeladenen Dokument (direction lässt sich aus einem
// einzelnen Dokument wie Parkschein/Bordkarte nicht zuverlässig ableiten).

export interface ExtractedTransfer {
  transfer_art: "auto" | "flug" | null;
  date: string | null; // YYYY-MM-DD
  parkplatz_anbieter: string | null;
  parkplatz_buchungslink: string | null;
  reservierungsnummer: string | null;
  flugnummer: string | null;
  airline: string | null;
  abflugzeit: string | null; // HH:MM, NIE geraten
  ankunftszeit: string | null; // HH:MM, NIE geraten
  notes: string | null;
}

export function parseExtractedTransfer(raw: string): ExtractedTransfer {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Konnte Transfer-Extraktion nicht als JSON parsen. Rohantwort:", raw);
    throw new Error(
      "Die Modellantwort war kein gültiges JSON. Bitte Foto erneut hochladen oder ein schärferes Bild versuchen."
    );
  }

  const obj = parsed as Partial<ExtractedTransfer>;

  return {
    transfer_art: obj.transfer_art === "auto" || obj.transfer_art === "flug" ? obj.transfer_art : null,
    date: obj.date ?? null,
    parkplatz_anbieter: obj.parkplatz_anbieter ?? null,
    parkplatz_buchungslink: obj.parkplatz_buchungslink ?? null,
    reservierungsnummer: obj.reservierungsnummer ?? null,
    flugnummer: obj.flugnummer ?? null,
    airline: obj.airline ?? null,
    abflugzeit: obj.abflugzeit ?? null,
    ankunftszeit: obj.ankunftszeit ?? null,
    notes: obj.notes ?? null,
  };
}
