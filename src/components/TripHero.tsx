import Link from "next/link";
import type { TripContext } from "@/lib/trip-context";

interface TripHeroProps {
  tripId: string;
  trip: TripContext["trip"];
  portCalls: TripContext["port_calls"];
}

export default function TripHero({ tripId, trip, portCalls }: TripHeroProps) {
  const dayCount = new Set(portCalls.map((pc) => pc.day_number)).size;
  const portDayCount = portCalls.filter((pc) => !pc.is_sea_day).length;
  const seaDayCount = portCalls.length - portDayCount;

  return (
    <div className="-mx-6 -mt-12 bg-fjord-dark px-6 pb-6 pt-8 text-white">
      <div className="mx-auto flex max-w-2xl items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight">{trip.ship_name}</h1>
          <p className="mt-2 text-fjord-light/70">
            {trip.route_name ?? "Route unbekannt"} · {trip.start_date} – {trip.end_date}
          </p>
        </div>
        <Link
          href={`/trips/${tripId}/edit`}
          className="shrink-0 rounded-lg border border-fjord-light/30 px-3 py-1.5 text-sm font-medium text-fjord-light transition hover:bg-white/10"
        >
          Bearbeiten
        </Link>
      </div>

      {portCalls.length > 0 && (
        <div className="mx-auto mt-6 max-w-2xl">
          <p className="text-xs text-fjord-light/50">
            {dayCount} Tage · {portDayCount} {portDayCount === 1 ? "Hafen" : "Häfen"}
            {seaDayCount > 0 && <> · {seaDayCount} {seaDayCount === 1 ? "Seetag" : "Seetage"}</>}
          </p>
          <div className="mt-2 flex items-center gap-1">
            {portCalls.map((pc, i) => (
              <span
                key={pc.id}
                title={`Tag ${pc.day_number}: ${pc.is_sea_day ? "Seetag" : pc.port_name}`}
                className={
                  "h-2 flex-1 rounded-full " + (pc.is_sea_day ? "bg-fjord-light/20" : "bg-fjord-light/70")
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
