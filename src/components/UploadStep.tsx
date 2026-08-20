"use client";

import { useRef, useState } from "react";
import { findOversizedFile, oversizedFileMessage } from "@/lib/document-upload";
import { SpinnerIcon } from "@/components/icons";

interface UploadStepProps {
  onExtracted: (result: unknown) => void;
}

export default function UploadStep({ onExtracted }: UploadStepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(selected: FileList | null) {
    if (!selected) return;
    const selectedFiles = Array.from(selected);

    const oversized = findOversizedFile(selectedFiles);
    if (oversized) {
      setError(oversizedFileMessage(oversized));
      setFiles([]);
      return;
    }

    setFiles(selectedFiles);
    setError(null);
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError("Bitte mindestens ein Foto auswählen.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));

      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Extraktion fehlgeschlagen.");
      }

      onExtracted(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.16em] text-ink/45">Logbuch</p>
        <h1 className="mt-1 font-display text-3xl italic text-ink">Reise anlegen</h1>
        <p className="mt-2 text-ink/70">
          Lade deine Buchungsbestätigung oder den Reiseverlauf als Foto oder PDF hoch.
          Mehrere Dateien sind möglich, wenn die Informationen auf mehrere Seiten verteilt sind.
        </p>
      </div>

      <div
        className="rounded-[18px] border-2 border-dashed border-stamp/40 bg-card p-8 text-center transition hover:border-stamp/70"
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          handleFileSelect(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <p className="font-medium text-stamp-deep">Foto oder PDF auswählen oder hierher ziehen</p>
        <p className="mt-1 font-mono text-[10.5px] text-ink/45">JPG, PNG, WEBP, GIF oder PDF (kein HEIC)</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-ink/80">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-stamp" />
              {file.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-stamp font-medium text-[15.5px] text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading && <SpinnerIcon className="h-4 w-4" />}
        {loading ? "Dokument wird gelesen …" : "Daten extrahieren"}
      </button>
    </div>
  );
}
