import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen. Bitte .env.local prüfen."
    );
  }
  return { url, anonKey };
}

/**
 * Request-gebundener Supabase-Client (Anon-Key + Session-Cookies der/des
 * eingeloggten Nutzer*in). Row-Level-Security greift, d.h. jede Query sieht
 * nur, worauf der Aufrufer laut RLS-Policies Zugriff hat - das ist der
 * Standard-Client für alle app/api/.../route.ts-Handler.
 */
export async function getSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // In Server Components (nicht in Route Handlers) kann set() nicht
          // aufgerufen werden - das Middleware übernimmt dort das Auffrischen
          // der Session, dieser Fall darf also folgenlos ignoriert werden.
        }
      },
    },
  });
}

/**
 * Service-Role-Client, der Row-Level-Security umgeht. NUR für echte
 * Admin-Operationen verwenden (Nutzerverwaltung über die Supabase Auth
 * Admin-API) - darf niemals im Browser-Bundle landen und niemals für
 * normale, nutzergebundene Datenzugriffe verwendet werden.
 */
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Bitte .env.local prüfen."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
