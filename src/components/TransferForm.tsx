"use client";

import { useRef, useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import { formatTimeInput } from "@/lib/format-time";
import { SpinnerIcon, CameraIcon } from "@/components/icons";
import { MAX_IMAGE_SIZE_BYTES, MAX_PDF_SIZE_BYTES } from "@/lib/document-upload";

const uploadLimitHint = `JPG, PNG, WEBP oder PDF · max. ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB / ${MAX_PDF_SIZE_BYTES / (1024 * 1024)} MB`;

type Transfer = TripContext["transfers"][number];

interface TransferFormProps {
  tripId: string;
  onAdded: (transfer: Transfer) => void;
}

const emptyForm = {
  direction: "anreise" as "anreise" | "abreise",
  transfer_art: "auto" as "auto" | "flug",
  date: "",
  parkplatz_anbieter: "",
  parkplatz_buchungslink: "",
  reservierungsnummer: "",
  flugnummer: "",
  airline: "",
  abflugzeit: "",
  ankunftszeit: "",
  notes: "",
};

export default function TransferForm({ tripId, onAdded }: TransferFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setExtracting(true);
    setError(null);
    setExtractNote(null);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await fetch("/api/extract/transfer", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraktion fehlgeschlagen.");

      setForm((f) => ({
        ...f,
        transfer_art: json.transfer_art === "flug" ? "flug" : "auto",
        date: json.date ?? "",
        parkplatz_anbieter: json.parkplatz_anbieter ?? "",
        parkplatz_buchungslink: json.parkplatz_buchungslink ?? "",
        reservierungsnummer: json.reservierungsnummer ?? "",
        flugnummer: json.flugnummer ?? "",
        airline: json.airline ?? "",
        abflugzeit: json.abflugzeit ?? "",
        ankunftszeit: json.ankunftszeit ?? "",
        notes: json.notes ?? "",
      }));
      setExtractNote(
        json.transfer_art
          ? `Erkannt: ${json.transfer_art === "flug" ? "Flug" : "Parkplatz"} - bitte prüfen und Anreise/Abreise auswählen.`
          : "Konnte die Art nicht sicher erkennen - bitte unten manuell auswählen."
      );
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setExtracting(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          direction: form.direction,
          transfer_art: form.transfer_art,
          date: form.date || null,
          parkplatz_anbieter: form.transfer_art === "auto" ? form.parkplatz_anbieter || null : null,
          parkplatz_buchungslink: form.transfer_art === "auto" ? form.parkplatz_buchungslink || null : null,
          reservierungsnummer: form.reservierungsnummer || null,
          flugnummer: form.transfer_art === "flug" ? form.flugnummer || null : null,
          airline: form.transfer_art === "flug" ? form.airline || null : null,
          abflugzeit: form.transfer_art === "flug" ? form.abflugzeit || null : null,
          ankunftszeit: form.transfer_art === "flug" ? form.ankunftszeit || null : null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen.");
      onAdded(json.transfer);
      setForm(emptyForm);
      setExtractNote(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-t-[22px] border border-ink/12 bg-card p-4">
        <div className="mx-auto mb-3 h-1 w-[38px] rounded-full bg-ink/15" />
        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-ink/45">Neue Anreise/Abreise</p>
        <p className="mt-0.5 font-display text-xl italic text-ink">Beleg abfotografieren</p>
        <p className="mt-1 text-sm text-ink/65">
          Parkschein oder Flugbuchung hochladen - Art, Zeiten und Referenzen werden ausgelesen.
        </p>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={extracting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-stamp px-4 py-2.5 text-sm font-medium text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {extracting ? <SpinnerIcon className="h-4 w-4" /> : <CameraIcon className="h-4 w-4" />}
            Kamera
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            PDF wählen
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-ink/40">{uploadLimitHint}</p>

        <button
          onClick={() => {
            setShowForm((v) => !v);
            setExtractNote(null);
          }}
          className="mt-3 text-sm font-medium text-sea hover:text-sea/80"
        >
          {showForm ? "Abbrechen" : "+ Manuell hinzufügen"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-[14px] border border-ink/10 p-3">
          {extractNote && <p className="text-xs text-sea">{extractNote}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Richtung</span>
              <select
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as "anreise" | "abreise" }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              >
                <option value="anreise">Anreise</option>
                <option value="abreise">Abreise</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Art</span>
              <select
                value={form.transfer_art}
                onChange={(e) => setForm((f) => ({ ...f, transfer_art: e.target.value as "auto" | "flug" }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              >
                <option value="auto">Auto</option>
                <option value="flug">Flug</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Datum</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>

            {form.transfer_art === "auto" ? (
              <>
                <label className="col-span-2 block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Parkplatz-Anbieter</span>
                  <input
                    type="text"
                    value={form.parkplatz_anbieter}
                    onChange={(e) => setForm((f) => ({ ...f, parkplatz_anbieter: e.target.value }))}
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
                <label className="col-span-2 block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Buchungslink</span>
                  <input
                    type="text"
                    value={form.parkplatz_buchungslink}
                    onChange={(e) => setForm((f) => ({ ...f, parkplatz_buchungslink: e.target.value }))}
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Flugnummer</span>
                  <input
                    type="text"
                    value={form.flugnummer}
                    onChange={(e) => setForm((f) => ({ ...f, flugnummer: e.target.value }))}
                    placeholder="z. B. LH123"
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Airline</span>
                  <input
                    type="text"
                    value={form.airline}
                    onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Abflug (HH:MM)</span>
                  <input
                    type="text"
                    value={form.abflugzeit}
                    onChange={(e) => setForm((f) => ({ ...f, abflugzeit: formatTimeInput(e.target.value) }))}
                    placeholder="z. B. 09:30"
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Ankunft (HH:MM)</span>
                  <input
                    type="text"
                    value={form.ankunftszeit}
                    onChange={(e) => setForm((f) => ({ ...f, ankunftszeit: formatTimeInput(e.target.value) }))}
                    placeholder="z. B. 11:45"
                    className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
                  />
                </label>
              </>
            )}

            <label className="col-span-2 block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
                {form.transfer_art === "auto" ? "Reservierungsnummer" : "Buchungscode"}
              </span>
              <input
                type="text"
                value={form.reservierungsnummer}
                onChange={(e) => setForm((f) => ({ ...f, reservierungsnummer: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Notizen</span>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
            />
          </label>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-[14px] bg-stamp px-4 py-2 text-sm font-medium text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <SpinnerIcon className="h-3.5 w-3.5" />}
            {saving ? "Speichert …" : "Eintrag speichern"}
          </button>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    </div>
  );
}
