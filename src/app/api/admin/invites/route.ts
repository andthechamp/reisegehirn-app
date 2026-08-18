import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: invites, error } = await supabaseAdmin
    .from("allowed_signup_emails")
    .select("email, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: invites ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const { email } = (await req.json()) as { email?: string };
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse ist erforderlich." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("allowed_signup_emails").insert({ email: trimmed });
  if (error && error.code !== "23505") {
    // 23505 = bereits auf der Liste
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  const { email } = (await req.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "email ist erforderlich." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("allowed_signup_emails")
    .delete()
    .eq("email", email.trim().toLowerCase());
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
