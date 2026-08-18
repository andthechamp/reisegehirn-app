import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trip-Anzahl pro Besitzer*in, damit die Nutzerverwaltung vor dem Löschen
  // eines Kontos warnen kann, dass trips.owner_id -> auth.users(id) ON DELETE
  // CASCADE dessen Reisen samt allen Daten darin mitlöscht (siehe schema.sql).
  const { data: trips, error: tripsError } = await supabaseAdmin.from("trips").select("owner_id");
  if (tripsError) {
    return NextResponse.json({ error: tripsError.message }, { status: 500 });
  }
  const tripCountByOwner = new Map<string, number>();
  for (const t of trips ?? []) {
    if (!t.owner_id) continue;
    tripCountByOwner.set(t.owner_id, (tripCountByOwner.get(t.owner_id) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((p) => ({ ...p, trip_count: tripCountByOwner.get(p.id) ?? 0 }));

  return NextResponse.json({ users });
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

// Löscht das Konto über die Supabase Auth Admin-API. profiles.id -> auth.users
// und trips.owner_id -> auth.users sind beide ON DELETE CASCADE (schema.sql),
// d.h. das Profil UND alle Reisen, die diese Person besitzt (inkl. Kabinen,
// Mitreisende, Häfen, Chat, Recherchen, Ausflüge darin), werden mitgelöscht.
// Die Warnung dazu sitzt in der UI (UserTable.tsx) vor der Bestätigung.
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const { user_id } = (await req.json()) as { user_id?: string };
  if (!user_id) {
    return NextResponse.json({ error: "user_id ist erforderlich." }, { status: 400 });
  }
  if (user_id === admin.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst entfernen." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
