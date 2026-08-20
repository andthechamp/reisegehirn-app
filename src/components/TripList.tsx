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

  if (loading) return null;

  if (trips.length === 0) {
    return (
      <div className="rounded-[18px] border-2 border-dashed border-ink/15 bg-card px-6 py-10 text-center">
        <p className="font-display text-xl italic text-ink">Noch kein Logbuch angelegt</p>
        <p className="mt-2 text-sm text-ink/60">
          Lade deine Buchungsbestätigung hoch, um deine erste Reise anzulegen.
        </p>
        <Link
          href="/trips/new"
          className="mt-5 inline-flex h-[46px] items-center justify-center rounded-[14px] bg-stamp px-6 font-medium text-[#FDF8F0] transition hover:bg-stamp-deep"
        >
          + Neue Reise anlegen
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {error && <div className="rounded-[14px] bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
      <ul className="space-y-2">
        {trips.map((trip) => (
          <li
            key={trip.id}
            className="flex items-center gap-2 rounded-[14px] border border-ink/12 bg-card px-4 py-3 text-sm transition hover:border-stamp/40"
          >
            <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1">
              <span className="font-display text-lg italic text-ink">{trip.ship_name}</span>
              <span className="block font-mono text-xs text-ink/55">
                {trip.route_name ?? "Route unbekannt"} · {trip.start_date} – {trip.end_date}
              </span>
            </Link>
            {trip.is_owner && (
              <button
                onClick={() => handleDelete(trip)}
                disabled={deletingId === trip.id}
                title="Reise löschen"
                className="shrink-0 text-xs text-ink/35 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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
