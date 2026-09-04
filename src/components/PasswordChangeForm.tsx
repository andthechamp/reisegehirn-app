"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function PasswordChangeForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setSaved(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unerwarteter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new_password" className="mb-1 block text-sm font-medium text-ink/80">
          Neues Passwort
        </label>
        <input
          id="new_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
      </div>
      <div>
        <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium text-ink/80">
          Neues Passwort bestätigen
        </label>
        <input
          id="confirm_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {saved && <div className="rounded-lg bg-fjord-light/40 px-4 py-3 text-sm text-ink/80">Passwort geändert.</div>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
      >
        {saving ? "Ändert …" : "Passwort ändern"}
      </button>
    </form>
  );
}
