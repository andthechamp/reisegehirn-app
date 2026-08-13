"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (res.ok) {
        setEmail(json.profile.email);
        setFullName(json.profile.full_name ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
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

  if (loading) return <p className="text-ink/60">Lädt …</p>;

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
