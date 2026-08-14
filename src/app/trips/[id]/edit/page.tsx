"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReviewStep from "@/components/ReviewStep";
import Spinner from "@/components/Spinner";
import type { ExtractionResult } from "@/lib/extraction-schema";
import type { TripContext } from "@/lib/trip-context";

function toEditableResult(context: TripContext): ExtractionResult {
  return {
    trip: {
      ship_name: context.trip.ship_name,
      route_name: context.trip.route_name,
      start_date: context.trip.start_date,
      end_date: context.trip.end_date,
      start_port: context.trip.start_port,
      end_port: context.trip.end_port,
    },
    bookings: context.bookings.map((b) => ({
      id: b.id,
      cabin_number: b.cabin_number,
      cabin_type: b.cabin_type,
      price_total: b.price_total,
      currency: b.currency,
      tariff: b.tariff,
      booking_reference: b.booking_reference,
    })),
    travelers: context.travelers.map((t) => ({
      id: t.id,
      name: t.name,
      age_at_trip: t.age_at_trip,
      cabin_number: t.cabin_number,
    })),
    port_calls: context.port_calls.map((pc) => ({
      id: pc.id,
      day_number: pc.day_number,
      call_date: pc.call_date,
      port_name: pc.port_name,
      arrival_time: pc.arrival_time,
      departure_time: pc.departure_time,
      is_sea_day: pc.is_sea_day,
    })),
    extraction_notes: [],
  };
}

export default function EditTripPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [initial, setInitial] = useState<ExtractionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen.");
        setInitial(toEditableResult(json.context as TripContext));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tripId]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <Spinner />
      </main>
    );
  }

  if (error || !initial) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? "Reise nicht gefunden."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <ReviewStep
        mode="edit"
        tripId={tripId}
        initial={initial}
        onBack={() => router.push(`/trips/${tripId}`)}
        onConfirmed={() => router.push(`/trips/${tripId}`)}
      />
    </main>
  );
}
