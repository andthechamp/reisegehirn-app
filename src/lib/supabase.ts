import { createClient } from "@supabase/supabase-js";

/**
 * Server-seitiger Supabase-Client mit dem Service-Role-Key.
 * NUR in app/api/.../route.ts verwenden - dieser Key umgeht Row-Level-Security
 * und darf niemals im Browser-Bundle landen.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Bitte .env.local prüfen."
    );
  }

  return createClient(url, key);
}
