"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";

interface InviteRow {
  email: string;
  created_at: string;
}

export default function InviteList() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen.");
      setInvites(json.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Hinzufügen fehlgeschlagen.");
      setNewEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(email: string) {
    setPendingEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Entfernen fehlgeschlagen.");
      setInvites((prev) => prev.filter((i) => i.email !== email));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setPendingEmail(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        Nur E-Mail-Adressen auf dieser Liste können sich unter /signup ein Konto anlegen - die Sperre
        greift direkt in der Datenbank, unabhängig davon, wie die Registrierung aufgerufen wird.
      </p>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="neue@mail.de"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full rounded-xl border border-ink/15 px-4 py-2 text-sm text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
        <button
          type="submit"
          disabled={adding}
          className="shrink-0 rounded-xl bg-fjord px-4 py-2 text-sm font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {adding ? "…" : "Freischalten"}
        </button>
      </form>

      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {invites.length === 0 && (
          <li className="px-4 py-3 text-sm text-ink/50">Noch niemand freigeschaltet.</li>
        )}
        {invites.map((i) => (
          <li key={i.email} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">{i.email}</p>
              <p className="text-xs text-ink/50">
                freigeschaltet seit {new Date(i.created_at).toLocaleDateString("de-DE")}
              </p>
            </div>
            <button
              onClick={() => handleRemove(i.email)}
              disabled={pendingEmail === i.email}
              className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Entfernen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
