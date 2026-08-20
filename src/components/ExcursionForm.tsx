"use client";

import { useRef, useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import { formatTimeInput } from "@/lib/format-time";
import { SpinnerIcon, CameraIcon } from "@/components/icons";
import { MAX_IMAGE_SIZE_BYTES, MAX_PDF_SIZE_BYTES } from "@/lib/document-upload";

const uploadLimitHint = `JPG, PNG, WEBP oder PDF · max. ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB / ${MAX_PDF_SIZE_BYTES / (1024 * 1024)} MB`;

type Excursion = TripContext["excursions"][number];
type PortCall = TripContext["port_calls"][number];

interface ExcursionFormProps {
  tripId: string;
  portCalls: PortCall[];
  onAdded: (excursion: Excursion) => void;
}

const emptyForm = {
  title: "",
  provider_type: "privat" as "reederei" | "privat",
  meeting_point: "",
  meeting_time: "",
  price_total: "",
  booking_reference: "",
  notes: "",
  port_call_id: "",
};

// Versucht, eine extrahierte Ausflugsbuchung automatisch dem richtigen
// Hafentag zuzuordnen: zuerst per exaktem Datum, sonst per Hafenname
// (Teilstring-Abgleich, da Schreibweisen leicht abweichen können).
function matchPortCall(portDays: PortCall[], callDate: string | null, portName: string | null): PortCall | null {
  if (callDate) {
    const byDate = portDays.find((pc) => pc.call_date === callDate);
    if (byDate) return byDate;
  }
  if (portName) {
    const needle = portName.trim().toLowerCase();
    const byName = portDays.find(
      (pc) => pc.port_name.toLowerCase().includes(needle) || needle.includes(pc.port_name.toLowerCase())
    );
    if (byName) return byName;
  }
  return null;
}

export default function ExcursionForm({ tripId, portCalls, onAdded }: ExcursionFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const portDays = portCalls.filter((pc) => !pc.is_sea_day);

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setExtracting(true);
    setError(null);
    setMatchNote(null);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await fetch("/api/extract/excursion", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraktion fehlgeschlagen.");

      const matched = matchPortCall(portDays, json.call_date, json.port_name);
      setForm({
        title: json.title ?? "",
        provider_type: json.provider_type === "reederei" ? "reederei" : "privat",
        meeting_point: json.meeting_point ?? "",
        meeting_time: json.meeting_time ?? "",
        price_total: json.price_total != null ? String(json.price_total) : "",
        booking_reference: json.booking_reference ?? "",
        notes: json.notes ?? "",
        port_call_id: matched?.id ?? "",
      });
      setMatchNote(
        matched
          ? `Automatisch zugeordnet: Tag ${matched.day_number} (${matched.call_date}), ${matched.port_name}.`
          : "Konnte den Hafentag nicht automatisch erkennen - bitte unten manuell auswählen."
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
    if (!form.title.trim()) {
      setError("Bitte einen Titel eintragen.");
      return;
    }
    if (!form.port_call_id) {
      setError("Bitte einen Hafentag auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/excursions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          port_call_id: form.port_call_id,
          title: form.title,
          provider_type: form.provider_type,
          meeting_point: form.meeting_point || null,
          meeting_time: form.meeting_time || null,
          price_total: form.price_total ? Number(form.price_total) : null,
          booking_reference: form.booking_reference || null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen.");
      onAdded(json.excursion);
      setForm(emptyForm);
      setMatchNote(null);
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
        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-ink/45">Neuer Ausflug</p>
        <p className="mt-0.5 font-display text-xl italic text-ink">Buchung abfotografieren</p>
        <p className="mt-1 text-sm text-ink/65">
          Anbieter, Treffpunkt, Zeit und Preis werden ausgelesen und dem richtigen Hafentag zugeordnet.
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
            setMatchNote(null);
          }}
          className="mt-3 text-sm font-medium text-sea hover:text-sea/80"
        >
          {showForm ? "Abbrechen" : "+ Manuell hinzufügen"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-[14px] border border-ink/10 p-3">
          {matchNote && <p className="text-xs text-sea">{matchNote}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Hafentag</span>
              <select
                value={form.port_call_id}
                onChange={(e) => setForm((f) => ({ ...f, port_call_id: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              >
                <option value="">– auswählen –</option>
                {portDays.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    Tag {pc.day_number} ({pc.call_date}) – {pc.port_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Titel</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Anbieter</span>
              <select
                value={form.provider_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider_type: e.target.value as "reederei" | "privat" }))
                }
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              >
                <option value="privat">Privat</option>
                <option value="reederei">Reederei</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Treffpunkt</span>
              <input
                type="text"
                value={form.meeting_point}
                onChange={(e) => setForm((f) => ({ ...f, meeting_point: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Uhrzeit (HH:MM)</span>
              <input
                type="text"
                value={form.meeting_time}
                onChange={(e) => setForm((f) => ({ ...f, meeting_time: formatTimeInput(e.target.value) }))}
                placeholder="z. B. 09:30"
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Preis</span>
              <input
                type="text"
                value={form.price_total}
                onChange={(e) => setForm((f) => ({ ...f, price_total: e.target.value }))}
                className="mt-1 w-full rounded-[14px] border border-ink/15 px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">Buchungsnummer</span>
              <input
                type="text"
                value={form.booking_reference}
                onChange={(e) => setForm((f) => ({ ...f, booking_reference: e.target.value }))}
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
            {saving ? "Speichert …" : "Ausflug speichern"}
          </button>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    </div>
  );
}
