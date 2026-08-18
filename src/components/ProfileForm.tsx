"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  initialEmail: string;
  initialFullName: string;
  initialChatLanguage: "de" | "vi";
}

export default function ProfileForm({ initialEmail, initialFullName, initialChatLanguage }: ProfileFormProps) {
  const router = useRouter();
  const [email] = useState(initialEmail);
  const [fullName, setFullName] = useState(initialFullName);
  const [chatLanguage, setChatLanguage] = useState(initialChatLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, chat_language: chatLanguage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink/80">E-Mail</label>
        <p className="text-sm text-ink/50">{email}</p>
      </div>
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-ink/80">
          Name
        </label>
        <input
          id="full_name"
          type="text"
          required
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Wie sollen wir dich nennen?"
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
      </div>

      <div>
        <label htmlFor="chat_language" className="mb-1 block text-sm font-medium text-ink/80">
          Chat-Sprache
        </label>
        <p className="mb-2 text-xs text-ink/50">
          Nur die Antworten im Chat wechseln die Sprache, der Rest der Seite bleibt Deutsch.
        </p>
        <select
          id="chat_language"
          value={chatLanguage}
          onChange={(e) => setChatLanguage(e.target.value as "de" | "vi")}
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        >
          <option value="de">Deutsch</option>
          <option value="vi">Tiếng Việt (Vietnamesisch)</option>
        </select>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {saved && <div className="rounded-lg bg-fjord-light/40 px-4 py-3 text-sm text-ink/80">Gespeichert.</div>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
      >
        {saving ? "Speichert …" : "Speichern"}
      </button>
    </form>
  );
}
