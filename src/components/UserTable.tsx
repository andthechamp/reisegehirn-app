"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin";
  created_at: string;
}

interface UserTableProps {
  currentUserId: string;
}

export default function UserTable({ currentUserId }: UserTableProps) {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen.");
      setUsers(json.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(u: ProfileRow) {
    const nextRole = u.role === "admin" ? "user" : "admin";
    setPendingId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id, role: nextRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ändern fehlgeschlagen.");
      setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, role: nextRole } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink" title={u.email}>
                {u.full_name || u.email}
                {u.id === currentUserId && <span className="ml-2 text-xs text-ink/40">(du)</span>}
              </p>
              <p className="text-xs text-ink/50">
                {u.full_name && `${u.email} · `}
                {u.role === "admin" ? "Admin" : "Nutzer"} · seit{" "}
                {new Date(u.created_at).toLocaleDateString("de-DE")}
              </p>
            </div>
            <button
              onClick={() => toggleRole(u)}
              disabled={pendingId === u.id}
              className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-fjord/40 hover:text-fjord-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {u.role === "admin" ? "Admin entziehen" : "Zu Admin machen"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
