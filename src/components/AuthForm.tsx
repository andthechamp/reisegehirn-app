"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(searchParams.get("redirect") || "/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSignupDone(true);
    setLoading(false);
  }

  if (signupDone) {
    return (
      <div className="rounded-lg bg-fjord-light/40 px-4 py-3 text-sm text-ink/80">
        Konto angelegt. Bitte den Bestätigungslink in deinem Postfach öffnen, um dich
        einzuloggen.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink/80">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink/80">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-ink/15 px-4 py-2.5 text-ink outline-none transition focus:border-fjord focus:ring-2 focus:ring-fjord/30"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
      >
        {loading ? "Bitte warten …" : mode === "login" ? "Einloggen" : "Konto anlegen"}
      </button>

      <p className="text-center text-sm text-ink/60">
        {mode === "login" ? (
          <>
            Noch kein Konto?{" "}
            <Link href="/signup" className="font-medium text-fjord-dark hover:underline">
              Registrieren
            </Link>
          </>
        ) : (
          <>
            Schon ein Konto?{" "}
            <Link href="/login" className="font-medium text-fjord-dark hover:underline">
              Einloggen
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
