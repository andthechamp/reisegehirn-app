import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile });
}

// Läuft über den Service-Role-Client statt einer RLS-Update-Policy auf
// profiles - eine Update-Policy für "eigene Zeile" würde sonst auch die
// role-Spalte für Selbst-Änderung öffnen (siehe Kommentar in schema.sql).
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const { full_name } = (await req.json()) as { full_name?: string };
  const trimmed = full_name?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }
  if (trimmed.length > 100) {
    return NextResponse.json({ error: "Name ist zu lang." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
