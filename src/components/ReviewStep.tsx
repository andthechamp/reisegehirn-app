"use client";

import { useRef, useState } from "react";
import type { ExtractionResult, ExtractedPortCall, ExtractedTraveler, ExtractedBooking } from "@/lib/extraction-schema";
import type { ExtractedItineraryDay } from "@/lib/itinerary-schema";
import { formatTimeInput } from "@/lib/format-time";
import { SpinnerIcon } from "@/components/icons";

function portNameMatches(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x.includes(y) || y.includes(x);
}

// Ordnet einen extrahierten Reiseverlauf-Tag dem passenden, bereits
// vorhandenen Hafentag zu. Datum ist der verlässlichste Abgleich, da manche
// Reederei-Apps den ersten Tag "Anreise" statt "Tag 1" nennen und dadurch
// beim Modell trotz Anweisung gelegentlich eine Tagesnummer-Verschiebung
// entstehen kann - das Kalenderdatum ist davon nicht betroffen. Liegen an
// einem Tag mehrere Häfen (z. B. zwei Fjord-Stopps am selben Kalendertag),
// reicht Datum/Tagesnummer allein nicht zur Unterscheidung - dann MUSS der
// Hafenname übereinstimmen, sonst lieber gar nicht zuordnen als raten.
function matchItineraryDay(portCalls: ExtractedPortCall[], day: ExtractedItineraryDay): ExtractedPortCall | null {
  const byDate = day.call_date ? portCalls.filter((pc) => pc.call_date === day.call_date) : [];
  const byDay = byDate.length > 0 ? byDate : portCalls.filter((pc) => pc.day_number === day.day_number);

  if (byDay.length === 1) return byDay[0];
  if (byDay.length > 1) {
    return day.port_name ? byDay.find((pc) => portNameMatches(pc.port_name, day.port_name!)) ?? null : null;
  }

  if (day.port_name) {
    return portCalls.find((pc) => portNameMatches(pc.port_name, day.port_name!)) ?? null;
  }
  return null;
}

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
      <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-ink/50">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
      />
    </label>
  );
}

export default function ReviewStep({ initial, onConfirmed, onBack, mode = "create", tripId }: ReviewStepProps) {
  const [data, setData] = useState<ExtractionResult>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractingTimes, setExtractingTimes] = useState(false);
  const [timesNote, setTimesNote] = useState<string | null>(null);
  const timesFileInputRef = useRef<HTMLInputElement>(null);

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

  // Lädt ein Foto/PDF des Reiseverlaufs (z. B. Screenshot der Kreuzfahrt-App)
  // und übernimmt daraus nur die An-/Abfahrtszeiten in die schon vorhandenen
  // Hafentage - per Tagesnummer zugeordnet, damit Hafenname/Datum/Reihenfolge
  // aus der ursprünglichen Extraktion erhalten bleiben.
  async function handleTimesFile(file: File | undefined) {
    if (!file) return;
    setExtractingTimes(true);
    setTimesNote(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await fetch("/api/extract/itinerary", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraktion fehlgeschlagen.");

      const extracted = json.port_calls as ExtractedItineraryDay[];
      let matched = 0;
      const unmatched: string[] = [];
      setData((prev) => {
        const port_calls = [...prev.port_calls];
        for (const day of extracted) {
          if (!day.arrival_time && !day.departure_time) continue;
          const target = matchItineraryDay(port_calls, day);
          if (!target) {
            unmatched.push(`${day.port_name ?? "Hafen unbekannt"} (${day.call_date ?? "Datum unbekannt"})`);
            continue;
          }
          const i = port_calls.indexOf(target);
          port_calls[i] = {
            ...target,
            arrival_time: day.arrival_time ?? target.arrival_time,
            departure_time: day.departure_time ?? target.departure_time,
          };
          matched += 1;
        }
        return { ...prev, port_calls };
      });
      const matchedText =
        matched > 0
          ? `Zeiten für ${matched} Tag${matched === 1 ? "" : "e"} übernommen - bitte unten gegenprüfen.`
          : "Keine der im Dokument erkannten Zeiten konnte einem vorhandenen Reisetag zugeordnet werden.";
      const unmatchedText = unmatched.length > 0 ? ` Nicht zugeordnet: ${unmatched.join(", ")}.` : "";
      setTimesNote(matchedText + unmatchedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setExtractingTimes(false);
      if (timesFileInputRef.current) timesFileInputRef.current.value = "";
    }
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

  function removeTraveler(index: number) {
    setData((prev) => ({
      ...prev,
      travelers: prev.travelers.filter((_, i) => i !== index),
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
        <p className="font-mono text-[11px] uppercase tracking-[.16em] text-ink/45">Logbuch</p>
        <h1 className="mt-1 font-display text-3xl italic text-ink">
          {mode === "edit" ? "Reise bearbeiten" : "Daten prüfen"}
        </h1>
        <p className="mt-2 text-ink/70">
          {mode === "edit"
            ? "Änderungen an Reise, Kabinen, Reiseverlauf oder Mitreisenden hier vornehmen."
            : "So habe ich das Dokument gelesen. Bitte kurz gegenprüfen und korrigieren, bevor die Reise gespeichert wird — danach gilt alles hier als bestätigt."}
        </p>
      </div>

      {data.extraction_notes.length > 0 && (
        <div className="rounded-[14px] border border-stamp/25 bg-stamp-tint px-4 py-3">
          <p className="text-sm font-medium text-stamp-deep">Bitte besonders prüfen:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink/80">
            {data.extraction_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl italic text-ink">Reise</h2>
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
          <h2 className="font-display text-xl italic text-ink">Kabinen / Buchungen</h2>
          <button
            onClick={addBooking}
            className="text-sm font-medium text-sea hover:opacity-80"
          >
            + Kabine hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {data.bookings.map((b, i) => (
            <div key={i} className="rounded-[14px] border border-ink/12 bg-card p-3">
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl italic text-ink">Reiseverlauf</h2>
          <div className="flex items-center gap-3">
            <input
              ref={timesFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => handleTimesFile(e.target.files?.[0])}
            />
            <button
              onClick={() => timesFileInputRef.current?.click()}
              disabled={extractingTimes}
              className="flex items-center gap-1.5 text-sm font-medium text-sea hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {extractingTimes && <SpinnerIcon className="h-3.5 w-3.5" />}
              {extractingTimes ? "Liest Dokument …" : "Zeiten aus Foto/PDF übernehmen"}
            </button>
          </div>
        </div>
        {timesNote && <p className="text-xs text-sea">{timesNote}</p>}
        <div className="space-y-2">
          {data.port_calls.map((pc, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 rounded-[14px] border border-ink/12 bg-card p-3">
              <Field label="Tag" value={pc.day_number} onChange={(v) => updatePortCall(i, { day_number: v === "" ? pc.day_number : Number(v) })} />
              <Field label="Datum" value={pc.call_date} onChange={(v) => updatePortCall(i, { call_date: v })} />
              <Field label="Hafen" value={pc.port_name} onChange={(v) => updatePortCall(i, { port_name: v })} />
              <Field
                label="Ankunft"
                value={pc.arrival_time}
                placeholder="unbekannt – nicht raten"
                onChange={(v) => updatePortCall(i, { arrival_time: formatTimeInput(v) || null })}
              />
              <Field
                label="Abfahrt"
                value={pc.departure_time}
                placeholder="unbekannt – nicht raten"
                onChange={(v) => updatePortCall(i, { departure_time: formatTimeInput(v) || null })}
              />
            </div>
          ))}
          {data.port_calls.length === 0 && (
            <p className="text-sm text-ink/50">Kein Reiseverlauf erkannt.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl italic text-ink">Mitreisende</h2>
        <div className="space-y-2">
          {data.travelers.map((t, i) => (
            <div key={i} className="rounded-[14px] border border-ink/12 bg-card p-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Name" value={t.name} onChange={(v) => updateTraveler(i, { name: v })} />
                <Field label="Alter zur Reisezeit" value={t.age_at_trip} onChange={(v) => updateTraveler(i, { age_at_trip: v ? Number(v) : null })} />
                <Field label="Kabine" value={t.cabin_number} onChange={(v) => updateTraveler(i, { cabin_number: v || null })} />
              </div>
              <button
                onClick={() => removeTraveler(i)}
                className="mt-2 text-xs font-medium text-ink/40 hover:text-red-700"
              >
                Mitreisenden entfernen
              </button>
            </div>
          ))}
          {data.travelers.length === 0 && (
            <p className="text-sm text-ink/50">Keine Mitreisenden erkannt.</p>
          )}
        </div>
      </section>

      {error && <div className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-[14px] border border-ink/20 px-6 py-3 font-medium text-ink/70 transition hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:ring-offset-2"
        >
          Zurück
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-stamp font-medium text-[15.5px] text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <SpinnerIcon className="h-4 w-4" />}
          {saving ? "Wird gespeichert …" : mode === "edit" ? "Änderungen speichern" : "Bestätigen und speichern"}
        </button>
      </div>
    </div>
  );
}
