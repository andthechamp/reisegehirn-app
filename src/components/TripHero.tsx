import Link from "next/link";
import type { TripContext } from "@/lib/trip-context";

interface TripHeroProps {
  tripId: string;
  trip: TripContext["trip"];
  portCalls: TripContext["port_calls"];
}

export default function TripHero({ tripId, trip, portCalls }: TripHeroProps) {
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
        <div className="mx-auto mt-6 max-w-2xl overflow-x-auto pb-1">
          <div className="flex w-max items-start">
            {portCalls.map((pc, i) => (
              <div key={pc.id} className="flex items-start">
                {i > 0 && <div className="mt-[7px] h-px w-8 shrink-0 bg-fjord-light/25 sm:w-10" />}
                <div className="flex w-16 flex-col items-center px-1 text-center">
                  <span className="text-[10px] text-fjord-light/50">Tag {pc.day_number}</span>
                  <span
                    className={
                      "my-1 h-2.5 w-2.5 rounded-full " +
                      (pc.is_sea_day ? "bg-fjord-light/30" : "bg-fjord-light")
                    }
                  />
                  <span className="text-[11px] leading-tight text-fjord-light/85">
                    {pc.is_sea_day ? "Seetag" : pc.port_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
