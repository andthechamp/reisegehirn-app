// Deterministischer Ersatz für die frühere KI-Websuche nach Wetter-Fakten
// (siehe wikimedia.ts für dasselbe Prinzip bei Sehenswürdigkeiten-Bildern):
// Open-Meteo liefert kostenlos, ohne API-Key, sowohl historische Messdaten
// als auch eine echte Vorhersage. Für ein zukünftiges Reisedatum (Kreuzfahrten
// werden oft Monate/Jahre im Voraus gebucht) bilden wir aus den historischen
// Daten einen klimatologischen Schnitt - eine echte Vorhersage ist auf diese
// Distanz nicht möglich. Liegt callDate dagegen innerhalb der tatsächlichen
// Vorhersage-Reichweite (kurz vor der Reise erneut recherchiert), wird
// zusätzlich die echte Vorhersage ergänzt.

const ARCHIVE_AIR_YEARS_BACK = 10;
const ARCHIVE_WATER_YEARS_BACK = 3; // Meerestemperatur-Archiv deckt nur wenige Jahre zuverlässig ab
const WINDOW_DAYS = 4; // +/- Tage um das Zieldatum, pro Jahr
const AIR_FORECAST_MAX_DAYS_AHEAD = 15;
const WATER_FORECAST_MAX_DAYS_AHEAD = 9;

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

async function geocodePort(portName: string): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({ name: portName, count: "1", language: "de", format: "json" });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") return null;
    return { latitude: result.latitude, longitude: result.longitude };
  } catch {
    return null;
  }
}

function windowDates(callDate: string, year: number): { start: string; end: string } {
  const [, month, day] = callDate.split("-").map(Number);
  const center = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(center);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
  const end = new Date(center);
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function daysFromToday(callDate: string): number {
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = callDate.split("-").map(Number);
  const targetUTC = Date.UTC(y, m - 1, d);
  return Math.round((targetUTC - todayUTC) / 86_400_000);
}

async function fetchDailyValues(url: string, key: string): Promise<(number | null)[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.daily?.[key] ?? null;
  } catch {
    return null;
  }
}

function average(values: number[]): number | null {
  return values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

interface AirClimateSummary {
  avgMaxC: number;
  avgMinC: number;
  avgPrecipMm: number;
  rainyDaysPercent: number;
  sampleDays: number;
}

async function getHistoricalAirSummary(
  lat: number,
  lon: number,
  callDate: string
): Promise<AirClimateSummary | null> {
  const currentYear = new Date().getUTCFullYear();
  const callYear = Number(callDate.split("-")[0]);
  const mostRecentCompleteYear = Math.min(currentYear, callYear) - 1;
  const years = Array.from({ length: ARCHIVE_AIR_YEARS_BACK }, (_, i) => mostRecentCompleteYear - i);

  const tmax: number[] = [];
  const tmin: number[] = [];
  const precip: number[] = [];

  await Promise.all(
    years.map(async (year) => {
      const { start, end } = windowDates(callDate, year);
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        start_date: start,
        end_date: end,
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
        timezone: "auto",
      });
      const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      for (const v of data?.daily?.temperature_2m_max ?? []) if (typeof v === "number") tmax.push(v);
      for (const v of data?.daily?.temperature_2m_min ?? []) if (typeof v === "number") tmin.push(v);
      for (const v of data?.daily?.precipitation_sum ?? []) if (typeof v === "number") precip.push(v);
    })
  );

  if (tmax.length === 0 || tmin.length === 0) return null;
  const rainyDays = precip.filter((p) => p > 0.5).length;

  return {
    avgMaxC: average(tmax)!,
    avgMinC: average(tmin)!,
    avgPrecipMm: average(precip) ?? 0,
    rainyDaysPercent: precip.length > 0 ? Math.round((100 * rainyDays) / precip.length) : 0,
    sampleDays: tmax.length,
  };
}

// Meerestemperatur-Archiv deckt zuverlässig nur die letzten paar Jahre ab
// (ältere Jahre liefern durchgehend null) - Jahre ohne Daten werden einfach
// übersprungen, statt das Gesamtergebnis zu verfälschen.
async function getHistoricalWaterTemp(lat: number, lon: number, callDate: string): Promise<number | null> {
  const currentYear = new Date().getUTCFullYear();
  const callYear = Number(callDate.split("-")[0]);
  const mostRecentCompleteYear = Math.min(currentYear, callYear) - 1;
  const years = Array.from({ length: ARCHIVE_WATER_YEARS_BACK }, (_, i) => mostRecentCompleteYear - i);

  const readings: number[] = [];
  await Promise.all(
    years.map(async (year) => {
      const { start, end } = windowDates(callDate, year);
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        start_date: start,
        end_date: end,
        daily: "sea_surface_temperature_max",
      });
      const values = await fetchDailyValues(
        `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`,
        "sea_surface_temperature_max"
      );
      for (const v of values ?? []) if (typeof v === "number") readings.push(v);
    })
  );

  return average(readings);
}

interface ForecastSummary {
  maxC: number | null;
  minC: number | null;
  precipMm: number | null;
  waterTempC: number | null;
}

// Echte Vorhersage nur sinnvoll, wenn callDate innerhalb der tatsächlichen
// Vorhersage-Reichweite von Open-Meteo liegt (Luft: ~16 Tage, Meer: ~10 Tage) -
// bei einer Monate im Voraus gebuchten Kreuzfahrt meist nicht der Fall, dann
// bleibt es beim historischen Schnitt.
async function getForecast(lat: number, lon: number, callDate: string): Promise<ForecastSummary | null> {
  const offset = daysFromToday(callDate);
  if (offset < 0) return null;

  let maxC: number | null = null;
  let minC: number | null = null;
  let precipMm: number | null = null;
  let waterTempC: number | null = null;

  if (offset <= AIR_FORECAST_MAX_DAYS_AHEAD) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
      forecast_days: "16",
      timezone: "auto",
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const idx = (data?.daily?.time ?? []).indexOf(callDate);
        if (idx >= 0) {
          maxC = data.daily.temperature_2m_max?.[idx] ?? null;
          minC = data.daily.temperature_2m_min?.[idx] ?? null;
          precipMm = data.daily.precipitation_sum?.[idx] ?? null;
        }
      }
    } catch {
      // kein Forecast, aber kein harter Fehler - historischer Schnitt bleibt gültig
    }
  }

  if (offset <= WATER_FORECAST_MAX_DAYS_AHEAD) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "sea_surface_temperature_max",
      forecast_days: "10",
    });
    try {
      const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const idx = (data?.daily?.time ?? []).indexOf(callDate);
        if (idx >= 0) waterTempC = data.daily.sea_surface_temperature_max?.[idx] ?? null;
      }
    } catch {
      // kein Forecast, kein harter Fehler
    }
  }

  return maxC === null && minC === null && waterTempC === null ? null : { maxC, minC, precipMm, waterTempC };
}

export interface WeatherFindingData {
  air: AirClimateSummary;
  waterTempC: number | null;
  forecast: ForecastSummary | null;
}

/**
 * Holt alle Wetter-Bausteine für einen Hafenanlauf: historischer Luft-Schnitt
 * (Pflicht), historische Wassertemperatur (falls verfügbar) und - nur wenn
 * callDate innerhalb der echten Vorhersage-Reichweite liegt - eine aktuelle
 * Vorhersage inkl. Wassertemperatur. Gibt null zurück, wenn der Ort nicht
 * geocodiert werden konnte oder keine historischen Luftdaten vorliegen.
 */
export async function getWeatherData(portName: string, callDate: string): Promise<WeatherFindingData | null> {
  const location = await geocodePort(portName);
  if (!location) return null;

  const [air, waterTempC, forecast] = await Promise.all([
    getHistoricalAirSummary(location.latitude, location.longitude, callDate),
    getHistoricalWaterTemp(location.latitude, location.longitude, callDate),
    getForecast(location.latitude, location.longitude, callDate),
  ]);

  if (!air) return null;
  return { air, waterTempC, forecast };
}

function packingTip(avgMaxC: number, rainyDaysPercent: number): string {
  const clothing =
    avgMaxC < 10
      ? "warme Kleidung, Mütze und Handschuhe einplanen"
      : avgMaxC < 18
        ? "Zwiebellook mit Pullover und Jacke einplanen"
        : avgMaxC < 25
          ? "leichte Kleidung, aber eine Jacke für kühlere Abende einpacken"
          : "leichte, luftige Kleidung und Sonnenschutz einplanen";
  const rain = rainyDaysPercent >= 30 ? ", dazu eine wind- und wasserfeste Jacke oder einen Schirm" : "";
  return `${clothing}${rain}, sowie bequeme Schuhe für Landausflüge.`;
}

const MONTH_NAMES_DE = new Intl.DateTimeFormat("de-DE", { month: "long" });
const DATE_FORMAT_DE = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" });

/**
 * Baut aus WeatherFindingData einen fertigen research_findings-Eintrag im
 * selben Format wie die übrigen (KI-recherchierten) Kategorien, damit er
 * unverändert zusammen mit ihnen gespeichert/angezeigt werden kann.
 */
export function buildWeatherFinding(portName: string, callDate: string, data: WeatherFindingData) {
  const dateObj = new Date(`${callDate}T00:00:00Z`);
  const monthName = MONTH_NAMES_DE.format(dateObj);
  const { air, waterTempC, forecast } = data;

  const bullets = [
    `Im ${monthName} liegen die Tageshöchsttemperaturen im Schnitt bei rund ${air.avgMaxC}°C, nachts kühlt es auf rund ${air.avgMinC}°C ab (historischer Schnitt der letzten ${ARCHIVE_AIR_YEARS_BACK} Jahre für dieses Datum, ${air.sampleDays} Messtage).`,
    `An etwa ${air.rainyDaysPercent}% der Tage in diesem Zeitraum fällt nennenswerter Niederschlag, im Schnitt rund ${air.avgPrecipMm} mm pro Tag.`,
  ];

  if (waterTempC !== null) {
    bullets.push(`Die Wassertemperatur liegt zu dieser Jahreszeit historisch bei rund ${waterTempC}°C.`);
  }

  if (forecast && (forecast.maxC !== null || forecast.waterTempC !== null)) {
    const dateLabel = DATE_FORMAT_DE.format(dateObj);
    const parts: string[] = [];
    if (forecast.maxC !== null && forecast.minC !== null) {
      parts.push(`Höchsttemperatur rund ${forecast.maxC}°C, nachts rund ${forecast.minC}°C`);
    }
    if (forecast.precipMm !== null) {
      parts.push(`Niederschlag ca. ${forecast.precipMm} mm`);
    }
    if (forecast.waterTempC !== null) {
      parts.push(`Wassertemperatur rund ${forecast.waterTempC}°C`);
    }
    if (parts.length > 0) {
      bullets.push(`Aktuelle Vorhersage für den ${dateLabel}: ${parts.join(", ")} (kann sich bis zum Anlauf noch ändern).`);
    }
  }

  bullets.push(`Packtipp: ${packingTip(air.avgMaxC, air.rainyDaysPercent)}`);

  return {
    category: "wetter_packen" as const,
    title: `${portName}: Wetter im ${monthName} & Packtipps`,
    content: bullets.map((b) => `• ${b}`).join(" "),
    source_tier: "A" as const,
    source_name: "Open-Meteo (historische Wetterdaten" + (forecast ? " & Vorhersage" : "") + ")",
    source_url: "https://open-meteo.com",
    staleness: "saisonal" as const,
  };
}
