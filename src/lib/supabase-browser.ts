"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-seitiger Supabase-Client (Anon-Key) für "use client"-Komponenten,
 * z. B. Login/Signup-Formulare. Persistiert die Session in Cookies, die auch
 * vom Server (getSupabaseServerClient / middleware.ts) gelesen werden.
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen. Bitte .env.local prüfen."
    );
  }
  return createBrowserClient(url, anonKey);
}
