import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Ziel des Bestätigungslinks aus der Signup-E-Mail. Tauscht den
// One-Time-Code gegen eine Session (setzt die Auth-Cookies) und leitet
// danach auf die Startseite weiter.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
