// Einmaliges Backfill-Skript: trägt für alle Häfen bestehender Reisen die
// Kategorie "wetter_packen" in port_research nach, falls sie noch fehlt.
// Nutzt dieselbe Logik wie der automatische Nachtrag in researchAndSavePort
// (siehe port-research.ts) - rein über die kostenlose Open-Meteo-API, KEIN
// Anthropic-Aufruf. Bestehende Zeilen (jeder Kategorie) bleiben unangetastet.
//
// Aufruf:
//   node --env-file=.env.local scripts/backfill-port-weather.ts

import { createClient } from "@supabase/supabase-js";
import { getWeatherData, buildWeatherFinding } from "../src/lib/weather";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

async function main() {
  const { data: portCalls, error: portCallsError } = await supabase
    .from("port_calls")
    .select("port_name, call_date")
    .eq("is_sea_day", false)
    .order("call_date", { ascending: true });
  if (portCallsError) throw new Error(portCallsError.message);

  // Pro Hafenname nur EIN Anlaufdatum (das früheste) - port_research ist nur
  // nach port_name geschlüsselt, nicht nach Datum, kann also ohnehin nur
  // einen Wetter-Eintrag pro Hafen führen (analog zur laufenden App).
  const firstCallDateByPort = new Map<string, string>();
  for (const row of portCalls ?? []) {
    if (!firstCallDateByPort.has(row.port_name)) {
      firstCallDateByPort.set(row.port_name, row.call_date);
    }
  }

  console.log(`${firstCallDateByPort.size} unterschiedliche Häfen gefunden.`);

  let filled = 0;
  let alreadyPresent = 0;
  let noWeatherData = 0;

  for (const [portName, callDate] of firstCallDateByPort) {
    const { data: existing, error: existingError } = await supabase
      .from("port_research")
      .select("id, sort_order")
      .eq("port_name", portName)
      .order("sort_order", { ascending: true });
    if (existingError) {
      console.error(`${portName}: Konnte bestehende Zeilen nicht laden - ${existingError.message}`);
      continue;
    }

    const { data: hasWeather } = await supabase
      .from("port_research")
      .select("id")
      .eq("port_name", portName)
      .eq("category", "wetter_packen")
      .limit(1);
    if (hasWeather && hasWeather.length > 0) {
      alreadyPresent += 1;
      continue;
    }

    const weatherData = await getWeatherData(portName, callDate);
    if (!weatherData) {
      console.warn(`${portName}: Keine Wetterdaten gefunden (Geocoding fehlgeschlagen?).`);
      noWeatherData += 1;
      continue;
    }

    const finding = buildWeatherFinding(portName, callDate, weatherData);
    const nextSortOrder = (existing ?? []).reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1) + 1;

    const { error: insertError } = await supabase.from("port_research").insert({
      port_name: portName,
      category: finding.category,
      title: finding.title,
      content: finding.content,
      source_tier: finding.source_tier,
      source_name: finding.source_name,
      source_url: finding.source_url,
      staleness: finding.staleness,
      sort_order: nextSortOrder,
    });
    if (insertError) {
      console.error(`${portName}: Insert fehlgeschlagen - ${insertError.message}`);
      continue;
    }

    console.log(`${portName}: Wetter/Packtipps ergänzt (${callDate}).`);
    filled += 1;
  }

  console.log(`\nFertig. Ergänzt: ${filled}, schon vorhanden: ${alreadyPresent}, ohne Wetterdaten: ${noWeatherData}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
