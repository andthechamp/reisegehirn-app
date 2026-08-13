"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  email: string;
}

interface ShareTripProps {
  tripId: string;
}

export default function ShareTrip({ tripId }: ShareTripProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/trips/${tripId}/share`);
    const json = await res.json();
    if (res.ok) setMembers(json.members);
  }

  useEffect(() => {
    load();
  }, [tripId]);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Teilen fehlgeschlagen.");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Entfernen fehlgeschlagen.");
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-medium text-ink">Reise teilen</h2>

      {members.length > 0 && (
        <ul className="space-y-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 px-3 py-2 text-sm"
            >
              <span className="text-ink/80">{m.email}</span>
              <button onClick={() => handleRemove(m.id)} className="text-xs text-ink/40 hover:text-red-700">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleShare} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="E-Mail des Kontos"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-xl border border-ink/15 px-3 py-2 text-sm text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-fjord px-4 py-2 text-sm font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Teilen
        </button>
      </form>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    </section>
  );
}
