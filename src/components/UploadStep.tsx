"use client";

import { useRef, useState } from "react";
import { findOversizedFile, oversizedFileMessage } from "@/lib/document-upload";

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
        <h1 className="font-display text-2xl font-semibold text-ink">Reise anlegen</h1>
        <p className="mt-2 text-ink/70">
          Lade deine Buchungsbestätigung oder den Reiseverlauf als Foto oder PDF hoch.
          Mehrere Dateien sind möglich, wenn die Informationen auf mehrere Seiten verteilt sind.
        </p>
      </div>

      <div
        className="rounded-2xl border-2 border-dashed border-fjord/40 bg-fjord-light/40 p-8 text-center transition hover:border-fjord/70"
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
        <p className="text-fjord-dark font-medium">Foto oder PDF auswählen oder hierher ziehen</p>
        <p className="mt-1 text-sm text-ink/50">JPG, PNG, WEBP, GIF oder PDF (kein HEIC)</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-ink/80">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-fjord" />
              {file.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
        className="w-full rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
      >
        {loading ? "Dokument wird gelesen …" : "Daten extrahieren"}
      </button>
    </div>
  );
}
