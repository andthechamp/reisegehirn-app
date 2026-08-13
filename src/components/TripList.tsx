"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TripSummary {
  id: string;
  ship_name: string;
  route_name: string | null;
  start_date: string;
  end_date: string;
}

export default function TripList() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/trips");
        const json = await res.json();
        if (!cancelled && res.ok) setTrips(json.trips);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || trips.length === 0) return null;

  return (
    <section className="mb-8 space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-ink/50">Meine Reisen</h2>
      <ul className="space-y-1">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/trips/${trip.id}`}
              className="block rounded-lg border border-ink/10 px-4 py-3 text-sm transition hover:border-fjord/40 hover:bg-fjord-light/40"
            >
              <span className="font-medium text-ink">{trip.ship_name}</span>
              <span className="text-ink/60">
                {" "}
                — {trip.route_name ?? "Route unbekannt"} · {trip.start_date} – {trip.end_date}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
