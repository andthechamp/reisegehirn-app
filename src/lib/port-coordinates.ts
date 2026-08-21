import type { SupabaseClient } from "@supabase/supabase-js";

export interface PortCoordinate {
  lat: number;
  lon: number;
}

const NOMINATIM_USER_AGENT = "Reisegehirn/1.0 (Reisebegleiter-App, siehe reisegehirn.app)";

// Nominatims Nutzungsbedingungen erlauben höchstens eine Anfrage pro
// Sekunde - nur relevant, wenn tatsächlich neu geocodet wird (nicht bei
// Cache-Treffern), daher hier statt global gedrosselt.
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocodet einen Hafennamen über Nominatim/OpenStreetMap. Klammerzusätze wie
 * "Nordfjordeid (Eidsfjord)" scheitern bei Nominatim oft als Gesamtstring,
 * der Ortsname davor findet aber zuverlässig - siehe Testlauf während der
 * Konzeption der Routenkarte. Gibt null zurück, wenn kein Treffer gefunden
 * wurde (Hafen bleibt dann ohne Koordinate, die Karte zeigt ihn nicht an).
 *
 * limit=5 statt 1: Nominatims Top-Treffer ist oft die Verwaltungsgrenze der
 * gleichnamigen Gemeinde (class "boundary"), deren Zentroid kilometerweit
 * vom eigentlichen Ort abweichen kann (siehe Ålesund: Gemeinde-Zentroid lag
 * ~15 km östlich der Stadt). Ein Ort/Stadt-Treffer (class "place") wird
 * daher bevorzugt, falls vorhanden.
 */
async function geocodePortName(portName: string): Promise<PortCoordinate | null> {
  const primaryName = portName.split("(")[0].trim();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(primaryName)}&format=json&limit=5`;

  const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
  if (!res.ok) return null;

  const results = (await res.json()) as Array<{ lat: string; lon: string; class: string }>;
  const best = results.find((r) => r.class === "place") ?? results[0];
  if (!best) return null;

  return { lat: Number(best.lat), lon: Number(best.lon) };
}

/**
 * Lädt Koordinaten für die übergebenen Hafennamen, geocodet fehlende
 * einmalig nach und cacht sie dauerhaft in port_coordinates (analog zu
 * ensurePortResearched, aber ohne Alters-Prüfung - ein Hafen bewegt sich
 * nicht, ein einmaliger Treffer bleibt gültig). Häfen ohne Geocoding-Treffer
 * fehlen im Ergebnis, statt den Aufruf für die ganze Reise scheitern zu
 * lassen - RouteMap.tsx zeigt dann nur die auffindbaren Häfen.
 */
export async function ensurePortCoordinates(
  supabase: SupabaseClient,
  portNames: string[]
): Promise<Map<string, PortCoordinate>> {
  const uniqueNames = [...new Set(portNames)];
  const result = new Map<string, PortCoordinate>();
  if (uniqueNames.length === 0) return result;

  const { data: cached, error: cachedError } = await supabase
    .from("port_coordinates")
    .select("port_name, lat, lon")
    .in("port_name", uniqueNames);
  if (cachedError) throw cachedError;

  for (const row of cached ?? []) {
    result.set(row.port_name as string, { lat: Number(row.lat), lon: Number(row.lon) });
  }

  const missingNames = uniqueNames.filter((name) => !result.has(name));
  let isFirstRequest = true;
  for (const name of missingNames) {
    if (!isFirstRequest) await delay(1100);
    isFirstRequest = false;

    try {
      const coord = await geocodePortName(name);
      if (!coord) {
        console.error(`Geocoding ohne Treffer für Hafen "${name}".`);
        continue;
      }
      result.set(name, coord);
      const { error: upsertError } = await supabase
        .from("port_coordinates")
        .upsert({ port_name: name, lat: coord.lat, lon: coord.lon }, { onConflict: "port_name" });
      if (upsertError) console.error(`Speichern der Koordinate für "${name}" fehlgeschlagen:`, upsertError);
    } catch (err) {
      console.error(`Geocoding fehlgeschlagen für Hafen "${name}":`, err);
    }
  }

  return result;
}
