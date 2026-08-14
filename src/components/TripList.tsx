"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TripSummary {
  id: string;
  ship_name: string;
  route_name: string | null;
  start_date: string;
  end_date: string;
  is_owner: boolean;
}

export default function TripList() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDelete(trip: TripSummary) {
    const label = `${trip.ship_name} — ${trip.route_name ?? "Route unbekannt"} (${trip.start_date} – ${trip.end_date})`;
    if (!window.confirm(`Reise wirklich unwiderruflich löschen?\n\n${label}`)) return;

    setError(null);
    setDeletingId(trip.id);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Löschen fehlgeschlagen.");
      setTrips((prev) => prev.filter((t) => t.id !== trip.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || trips.length === 0) return null;

  return (
    <section className="mb-8 space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-ink/50">Meine Reisen</h2>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
      <ul className="space-y-1">
        {trips.map((trip) => (
          <li
            key={trip.id}
            className="flex items-center gap-2 rounded-lg border border-ink/10 px-4 py-3 text-sm transition hover:border-fjord/40 hover:bg-fjord-light/40"
          >
            <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1">
              <span className="font-medium text-ink">{trip.ship_name}</span>
              <span className="text-ink/60">
                {" "}
                — {trip.route_name ?? "Route unbekannt"} · {trip.start_date} – {trip.end_date}
              </span>
            </Link>
            {trip.is_owner && (
              <button
                onClick={() => handleDelete(trip)}
                disabled={deletingId === trip.id}
                title="Reise löschen"
                className="shrink-0 text-xs text-ink/30 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingId === trip.id ? "Löscht …" : "Löschen"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
