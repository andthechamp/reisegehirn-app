"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AnchorIcon } from "@/components/icons";

interface AuthFormProps {
  mode: "login" | "signup";
  // Serverseitig via lookupWikipediaImage() aufgelöst (siehe login/page.tsx) -
  // mangels Trip-Kontext vor dem Login ein fester Platzhalter (Geirangerfjord,
  // wie im Prototyp-Handoff), kein per-Reise-Foto.
  heroImageUrl?: string | null;
}

export default function AuthForm({ mode, heroImageUrl }: AuthFormProps) {
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

  return (
    <div className="relative -mx-6 -mt-12 min-h-[calc(100vh-53px)] overflow-hidden bg-gradient-to-br from-[#7a6552] via-[#4a3f34] to-logbook text-[#F7F1E6] lg:mx-0 lg:mt-0">
      {heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(35,32,27,.45) 0%, rgba(35,32,27,.05) 45%, rgba(35,32,27,.85) 100%)",
        }}
      />

      {/* Eigener positionierter Wrapper statt flex direkt auf dem Hero-Container:
          Foto und Verlauf sind sonst Flex-Items wie dieser Inhalt und landen
          trotz negativem z-index über dem eigenen Gradient-Hintergrund. */}
      <div className="relative flex min-h-[calc(100vh-53px)] flex-col px-6 pb-10 pt-8 lg:items-center lg:justify-center lg:px-10">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-[#F7F1E6]/90 lg:absolute lg:left-10 lg:top-8">
          <AnchorIcon className="h-5 w-5" />
          Reisegehirn
        </div>

        <div className="mt-auto lg:mt-0 lg:w-full lg:max-w-md lg:rounded-[24px] lg:border lg:border-[#F7F1E6]/15 lg:bg-[#23201B]/40 lg:px-10 lg:py-10 lg:shadow-2xl lg:backdrop-blur-[2px]">
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-[#F7F1E6]/70">
          {mode === "login" ? "Logbuch Nr. 4" : "Erste Eintragung"}
        </p>
        <h1 className="mt-1 font-display text-[46px] italic leading-[0.96]">
          {mode === "login" ? (
            <>
              Willkommen
              <br />
              an Bord
            </>
          ) : (
            <>
              Neues
              <br />
              Logbuch
            </>
          )}
        </h1>

        {signupDone ? (
          <div className="mt-6 rounded-[14px] border border-[#F7F1E6]/28 bg-[#F7F1E6]/10 px-4 py-3 text-sm text-[#F7F1E6]/90">
            Konto angelegt. Bitte den Bestätigungslink in deinem Postfach öffnen, um dich
            einzuloggen.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="rounded-[14px] border border-[#F7F1E6]/28 bg-[#F7F1E6]/10 px-4 py-2">
              <label htmlFor="email" className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-[#F7F1E6]/60">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent py-1 text-[#F7F1E6] outline-none placeholder:text-[#F7F1E6]/40"
              />
            </div>
            <div className="rounded-[14px] border border-[#F7F1E6]/28 bg-[#F7F1E6]/10 px-4 py-2">
              <label htmlFor="password" className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-[#F7F1E6]/60">
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
                className="w-full bg-transparent py-1 text-[#F7F1E6] outline-none"
              />
            </div>

            {error && (
              <div className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-[52px] w-full rounded-[14px] bg-stamp font-medium text-[15.5px] text-[#FDF8F0] transition hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Bitte warten …" : mode === "login" ? "Einloggen" : "Konto anlegen"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-[#F7F1E6]/70">
          {mode === "login" ? (
            <>
              Noch kein Konto?{" "}
              <Link href="/signup" className="font-medium text-[#F7F1E6] underline underline-offset-2">
                Registrieren
              </Link>
            </>
          ) : (
            <>
              Schon ein Konto?{" "}
              <Link href="/login" className="font-medium text-[#F7F1E6] underline underline-offset-2">
                Einloggen
              </Link>
            </>
          )}
        </p>
        <p className="mt-1 text-center font-mono text-[10px] text-[#F7F1E6]/50">
          Zugang nur für freigeschaltete Adressen
        </p>
        </div>
      </div>
    </div>
  );
}
