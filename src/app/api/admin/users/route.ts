import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase";

// Bestätigt anhand der Session (RLS-Client, kein Vertrauen in Client-Input),
// dass die aufrufende Person Admin ist, bevor irgendetwas über den
// Service-Role-Client (der RLS umgeht) gemacht wird.
async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;

  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: profiles ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const { user_id, role } = (await req.json()) as { user_id?: string; role?: string };
  if (!user_id || (role !== "user" && role !== "admin")) {
    return NextResponse.json({ error: "user_id und role ('user'|'admin') sind erforderlich." }, { status: 400 });
  }
  if (user_id === admin.id && role === "user") {
    return NextResponse.json({ error: "Du kannst dir nicht selbst die Admin-Rolle entziehen." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("profiles").update({ role }).eq("id", user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
