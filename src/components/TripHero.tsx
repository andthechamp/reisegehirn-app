import Link from "next/link";
import type { TripContext } from "@/lib/trip-context";
import RouteMap, { type RouteMapPort } from "@/components/RouteMap";

type PortCall = TripContext["port_calls"][number];

interface TripHeroProps {
  tripId: string;
  trip: TripContext["trip"];
  portCalls: PortCall[];
  excursions: TripContext["excursions"];
  bookings: TripContext["bookings"];
  travelers: TripContext["travelers"];
  portCoordinates: Record<string, { lat: number; lon: number }>;
  // Via resolveShipPhoto(shipName) serverseitig aufgelöst (siehe
  // /api/trips/[id]/route.ts) - null, wenn kein passendes Foto gefunden wurde.
  heroImageUrl?: string | null;
  // Nur bei Commons-Fotos gesetzt (CC-BY-SA-Namensnennungspflicht) - null bei
  // lokalen Fotos oder offiziellen Wikipedia-Titelbildern.
  heroImageAttribution?: string | null;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Kurzer Ortsname ohne den Klammerzusatz (z. B. "Nordfjordeid" statt
// "Nordfjordeid (Eidsfjord)") - für Fließtext und Kartenlabels lesbarer,
// siehe auch primaryName in port-coordinates.ts.
function shortPortName(portName: string): string {
  return portName.split("(")[0].trim();
}

export default function TripHero({
  tripId,
  trip,
  portCalls,
  excursions,
  bookings,
  travelers,
  portCoordinates,
  heroImageUrl,
  heroImageAttribution,
}: TripHeroProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const nonSeaPortCalls = portCalls.filter((pc) => !pc.is_sea_day);
  const dayCount = new Set(portCalls.map((pc) => pc.day_number)).size;
  const portDayCount = nonSeaPortCalls.length;
  const seaDayCount = portCalls.length - portDayCount;

  const hasExcursion = (portCallId: string) => excursions.some((e) => e.port_call_id === portCallId);

  // Welcher Tag hervorgehoben wird, hängt von der Reisephase ab: in der
  // Vorbereitung (heute vor Reisestart) ist das der nächste Hafen ohne
  // Ausflug - das Nützlichste, worauf man in dieser Phase blicken kann. Auf
  // See/nach der Reise der aktuelle bzw. nächste Hafen ab heute.
  const highlightedPortCall: PortCall | null =
    todayStr < trip.start_date
      ? nonSeaPortCalls.find((pc) => !hasExcursion(pc.id)) ?? nonSeaPortCalls[0] ?? null
      : todayStr > trip.end_date
        ? null
        : nonSeaPortCalls.find((pc) => pc.call_date >= todayStr) ??
          [...nonSeaPortCalls].reverse().find((pc) => pc.call_date <= todayStr) ??
          null;

  const highlightedDatePorts = highlightedPortCall
    ? nonSeaPortCalls.filter((pc) => pc.call_date === highlightedPortCall.call_date)
    : [];

  const calloutText =
    highlightedDatePorts.length <= 1
      ? hasExcursion(highlightedPortCall?.id ?? "")
        ? "Ausflug gebucht."
        : "Noch kein Ausflug gebucht."
      : highlightedDatePorts
          .map((pc) =>
            hasExcursion(pc.id)
              ? `für ${shortPortName(pc.port_name)} ist ein Ausflug gebucht`
              : `für ${shortPortName(pc.port_name)} noch offen`
          )
          .join(", ") + ".";

  function portState(pc: PortCall): RouteMapPort["state"] {
    if (pc.call_date < todayStr) return "done";
    if (highlightedPortCall && pc.call_date === highlightedPortCall.call_date) return "today";
    return "upcoming";
  }

  const mapPorts: RouteMapPort[] = nonSeaPortCalls.flatMap((pc) => {
    const coord = portCoordinates[pc.port_name];
    if (!coord) return [];
    return [{ port_name: pc.port_name, lat: coord.lat, lon: coord.lon, day_number: pc.day_number, state: portState(pc) }];
  });

  const bookingsReady = bookings.length > 0 && travelers.length > 0;
  const excursionsPlannedCount = nonSeaPortCalls.filter((pc) => hasExcursion(pc.id)).length;

  const firstBooking = bookings[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="relative -mx-6 -mt-12 overflow-hidden bg-gradient-to-br from-[#7a6552] via-[#4a3f34] to-logbook text-[#F7F1E6]">
        {heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_70%]" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(35,32,27,.45) 0%, rgba(35,32,27,.05) 45%, rgba(35,32,27,.85) 100%)",
          }}
        />
        {heroImageAttribution && (
          <p className="absolute bottom-1.5 right-2 font-mono text-[9px] text-[#F7F1E6]/50">
            Foto: {heroImageAttribution}
          </p>
        )}
        <div className="relative mx-auto max-w-2xl px-6 pb-6 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.18em] text-[#F7F1E6]/70">
                {trip.route_name ?? "Route unbekannt"} · {dayCount} Tage
              </p>
              <h1 className="mt-1 font-display text-4xl italic leading-tight">{trip.ship_name}</h1>
              <p className="mt-2 text-[#F7F1E6]/70">
                {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
              </p>
            </div>
            <Link
              href={`/trips/${tripId}/edit`}
              className="shrink-0 rounded-full border border-[#F7F1E6]/50 px-3 py-1.5 text-sm font-medium text-[#F7F1E6] transition hover:bg-[#F7F1E6]/10"
            >
              Bearbeiten
            </Link>
          </div>

          {portCalls.length > 0 && (
            <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1">
              {portCalls.map((pc) => {
                const state = pc.is_sea_day ? "upcoming" : portState(pc);
                return (
                  <div
                    key={pc.id}
                    title={`Tag ${pc.day_number}: ${pc.is_sea_day ? "Seetag" : pc.port_name}`}
                    className={
                      "min-w-[64px] flex-1 rounded-[12px] px-1.5 pb-2 pt-1.5 text-center " +
                      (state === "today" ? "bg-stamp" : "")
                    }
                  >
                    <span
                      className={
                        "block font-mono text-[9.5px] uppercase tracking-[.1em] " +
                        (state === "today" ? "text-[#FDF8F0]/80" : "text-[#F7F1E6]/50")
                      }
                    >
                      Tag {pc.day_number}
                    </span>
                    <span
                      className={
                        "block truncate text-[11px] " +
                        (state === "today" ? "font-semibold text-[#FDF8F0]" : "text-[#F7F1E6]/80")
                      }
                    >
                      {pc.is_sea_day ? "Seetag" : shortPortName(pc.port_name)}
                    </span>
                    <span
                      className={
                        "mt-1.5 block h-[7px] rounded-full " +
                        (state === "today"
                          ? "bg-[#FDF8F0]"
                          : pc.is_sea_day
                            ? "bg-[#F7F1E6]/30"
                            : "bg-[#F7F1E6]")
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 font-mono text-[11px] uppercase tracking-[.14em] text-[#F7F1E6]/50">
            {portDayCount} {portDayCount === 1 ? "HAFEN" : "HÄFEN"}
            {seaDayCount > 0 && <> · {seaDayCount} {seaDayCount === 1 ? "SEETAG" : "SEETAGE"}</>}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {mapPorts.length > 0 && (
          <div className="h-56 w-full overflow-hidden rounded-[14px] border border-ink/12 sm:h-72">
            <RouteMap ports={mapPorts} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[14px] border border-ink/12 bg-card p-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-ink/45">Morgen</p>
            {highlightedPortCall ? (
              <>
                <p className="mt-1 font-medium text-ink">
                  {highlightedDatePorts.map((pc) => shortPortName(pc.port_name)).join(" & ")}
                </p>
                <p className="mt-1 font-mono text-xs text-sea">
                  {highlightedPortCall.arrival_time && highlightedPortCall.departure_time
                    ? `An ${highlightedPortCall.arrival_time} · Ab ${highlightedPortCall.departure_time}`
                    : calloutText}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink/50">Keine weiteren Häfen.</p>
            )}
          </div>
          <div className="rounded-[14px] border border-ink/12 bg-card p-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-ink/45">Kabine</p>
            {firstBooking ? (
              <>
                <p className="mt-1 font-mono text-[15px] font-bold text-ink">{firstBooking.cabin_number ?? "—"}</p>
                <p className="mt-0.5 text-xs text-ink/65">{firstBooking.cabin_type ?? "Typ unbekannt"}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink/50">Noch keine Kabine.</p>
            )}
          </div>
        </div>

        {portDayCount > 0 && (
          <div className="rounded-[14px] border border-ink/12 bg-card p-4">
            <h3 className="font-display text-base font-medium text-ink">Vorbereitungsstand</h3>
            <div className="mt-3 flex items-center gap-2.5">
              <span className={"h-2 w-2 shrink-0 rounded-full " + (bookingsReady ? "bg-stamp" : "border border-ink/20")} />
              <p className="text-sm text-ink/70">
                {bookingsReady ? "Kabine & Mitreisende hinterlegt" : "Noch keine Kabine hinterlegt"}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className={
                  "h-2 w-2 shrink-0 rounded-full " +
                  (excursionsPlannedCount === portDayCount && portDayCount > 0 ? "bg-stamp" : "border border-ink/20")
                }
              />
              <p className="text-sm text-ink/70">
                {excursionsPlannedCount} von {portDayCount} Ausflügen geplant
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
