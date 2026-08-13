"use client";

import { useState } from "react";
import type { ExtractionResult, ExtractedPortCall, ExtractedTraveler, ExtractedBooking } from "@/lib/extraction-schema";

interface ReviewStepProps {
  initial: ExtractionResult;
  onConfirmed: (tripId: string) => void;
  onBack: () => void;
  // "edit" lädt eine bereits gespeicherte Reise zum Nachbearbeiten (braucht
  // tripId, speichert per PUT statt POST) - sonst normaler Extraktions-Flow.
  mode?: "create" | "edit";
  tripId?: string;
}

// Kleines, wiederverwendbares Eingabefeld mit Label - für null zeigen wir
// ein leeres Feld statt "null", damit klar ist: hier fehlt eine Angabe.
function Field({
  label,
  value,
  onChange,
  placeholder = "unbekannt",
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-fjord focus:outline-none focus:ring-1 focus:ring-fjord"
      />
    </label>
  );
}

export default function ReviewStep({ initial, onConfirmed, onBack, mode = "create", tripId }: ReviewStepProps) {
  const [data, setData] = useState<ExtractionResult>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePortCall(index: number, patch: Partial<ExtractedPortCall>) {
    setData((prev) => {
      const port_calls = [...prev.port_calls];
      port_calls[index] = { ...port_calls[index], ...patch };
      return { ...prev, port_calls };
    });
  }

  function updateTraveler(index: number, patch: Partial<ExtractedTraveler>) {
    setData((prev) => {
      const travelers = [...prev.travelers];
      travelers[index] = { ...travelers[index], ...patch };
      return { ...prev, travelers };
    });
  }

  function updateBooking(index: number, patch: Partial<ExtractedBooking>) {
    setData((prev) => {
      const bookings = [...prev.bookings];
      bookings[index] = { ...bookings[index], ...patch };
      return { ...prev, bookings };
    });
  }

  function addBooking() {
    setData((prev) => ({
      ...prev,
      bookings: [
        ...prev.bookings,
        {
          cabin_number: null,
          cabin_type: null,
          price_total: null,
          currency: null,
          tariff: null,
          booking_reference: null,
        },
      ],
    }));
  }

  function removeBooking(index: number) {
    setData((prev) => ({
      ...prev,
      bookings: prev.bookings.filter((_, i) => i !== index),
    }));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(mode === "edit" ? `/api/trips/${tripId}` : "/api/confirm", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen.");
      onConfirmed(json.trip_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          {mode === "edit" ? "Reise bearbeiten" : "Daten prüfen"}
        </h1>
        <p className="mt-2 text-ink/70">
          {mode === "edit"
            ? "Änderungen an Reise, Kabinen, Reiseverlauf oder Mitreisenden hier vornehmen."
            : "So habe ich das Dokument gelesen. Bitte kurz gegenprüfen und korrigieren, bevor die Reise gespeichert wird — danach gilt alles hier als bestätigt."}
        </p>
      </div>

      {data.extraction_notes.length > 0 && (
        <div className="rounded-xl bg-amber-light px-4 py-3">
          <p className="text-sm font-medium text-amber">Bitte besonders prüfen:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink/80">
            {data.extraction_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Reise</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Schiff" value={data.trip.ship_name} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, ship_name: v } }))} />
          <Field label="Route" value={data.trip.route_name} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, route_name: v } }))} />
          <Field label="Start (YYYY-MM-DD)" value={data.trip.start_date} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, start_date: v } }))} />
          <Field label="Ende (YYYY-MM-DD)" value={data.trip.end_date} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, end_date: v } }))} />
          <Field label="Starthafen" value={data.trip.start_port} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, start_port: v } }))} />
          <Field label="Endhafen" value={data.trip.end_port} onChange={(v) => setData((p) => ({ ...p, trip: { ...p.trip, end_port: v } }))} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-ink">Kabinen / Buchungen</h2>
          <button
            onClick={addBooking}
            className="text-sm font-medium text-fjord hover:text-fjord-dark"
          >
            + Kabine hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {data.bookings.map((b, i) => (
            <div key={i} className="rounded-lg border border-ink/10 p-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Kabine" value={b.cabin_number} onChange={(v) => updateBooking(i, { cabin_number: v || null })} />
                <Field label="Kabinentyp" value={b.cabin_type} onChange={(v) => updateBooking(i, { cabin_type: v || null })} />
                <Field label="Preis" value={b.price_total} onChange={(v) => updateBooking(i, { price_total: v ? Number(v) : null })} />
                <Field label="Währung" value={b.currency} onChange={(v) => updateBooking(i, { currency: v || null })} />
                <Field label="Tarif" value={b.tariff} onChange={(v) => updateBooking(i, { tariff: v || null })} />
                <Field label="Buchungsnummer" value={b.booking_reference} onChange={(v) => updateBooking(i, { booking_reference: v || null })} />
              </div>
              <button
                onClick={() => removeBooking(i)}
                className="mt-2 text-xs font-medium text-ink/40 hover:text-red-700"
              >
                Kabine entfernen
              </button>
            </div>
          ))}
          {data.bookings.length === 0 && (
            <p className="text-sm text-ink/50">Keine Buchung erkannt.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Reiseverlauf</h2>
        <div className="space-y-2">
          {data.port_calls.map((pc, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 rounded-lg border border-ink/10 p-3">
              <Field label="Tag" value={pc.day_number} onChange={(v) => updatePortCall(i, { day_number: v === "" ? pc.day_number : Number(v) })} />
              <Field label="Datum" value={pc.call_date} onChange={(v) => updatePortCall(i, { call_date: v })} />
              <Field label="Hafen" value={pc.port_name} onChange={(v) => updatePortCall(i, { port_name: v })} />
              <Field
                label="Ankunft"
                value={pc.arrival_time}
                placeholder="unbekannt – nicht raten"
                onChange={(v) => updatePortCall(i, { arrival_time: v || null })}
              />
              <Field
                label="Abfahrt"
                value={pc.departure_time}
                placeholder="unbekannt – nicht raten"
                onChange={(v) => updatePortCall(i, { departure_time: v || null })}
              />
            </div>
          ))}
          {data.port_calls.length === 0 && (
            <p className="text-sm text-ink/50">Kein Reiseverlauf erkannt.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Mitreisende</h2>
        <div className="space-y-2">
          {data.travelers.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Field label="Name" value={t.name} onChange={(v) => updateTraveler(i, { name: v })} />
              <Field label="Alter zur Reisezeit" value={t.age_at_trip} onChange={(v) => updateTraveler(i, { age_at_trip: v ? Number(v) : null })} />
              <Field label="Kabine" value={t.cabin_number} onChange={(v) => updateTraveler(i, { cabin_number: v || null })} />
            </div>
          ))}
          {data.travelers.length === 0 && (
            <p className="text-sm text-ink/50">Keine Mitreisenden erkannt.</p>
          )}
        </div>
      </section>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-ink/20 px-6 py-3 font-medium text-ink/70 transition hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:ring-offset-2"
        >
          Zurück
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="flex-1 rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
        >
          {saving ? "Wird gespeichert …" : mode === "edit" ? "Änderungen speichern" : "Bestätigen und speichern"}
        </button>
      </div>
    </div>
  );
}
