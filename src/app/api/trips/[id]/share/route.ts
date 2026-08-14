import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseAdminClient } from "@/lib/supabase";

function errorMessage(err: unknown) {
  return err instanceof Error
    ? err.message
    : typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : "Unbekannter Fehler.";
}

// Nur der Besitzer einer Reise darf sie teilen/Freigaben entfernen - RLS auf
// trip_members erzwingt das für insert/delete zusätzlich auf DB-Ebene, diese
// Prüfung liefert nur die passende Fehlermeldung statt eines rohen RLS-Fehlers.
async function requireOwner(tripId: string) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { supabase, user: null, isOwner: false };

  const { data: trip } = await supabase.from("trips").select("owner_id").eq("id", tripId).single();
  return { supabase, user, isOwner: trip?.owner_id === user.id };
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { supabase, user, isOwner } = await requireOwner(params.id);
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    if (!isOwner) return NextResponse.json({ error: "Nur der Besitzer sieht die Freigaben." }, { status: 403 });

    const { data: members, error } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", params.id);
    if (error) throw error;

    const userIds = (members ?? []).map((m) => m.user_id as string);
    if (userIds.length === 0) return NextResponse.json({ members: [] });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    if (profilesError) throw profilesError;

    return NextResponse.json({ members: profiles ?? [] });
  } catch (err) {
    console.error("Freigaben laden fehlgeschlagen:", err);
    return NextResponse.json({ error: `Laden fehlgeschlagen: ${errorMessage(err)}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { supabase, user, isOwner } = await requireOwner(params.id);
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    if (!isOwner) return NextResponse.json({ error: "Nur der Besitzer kann teilen." }, { status: 403 });

    const { email } = (await req.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "E-Mail ist erforderlich." }, { status: 400 });
    }

    const { data: foundUserId, error: lookupError } = await supabase.rpc("find_user_id_by_email", {
      lookup_email: email.trim().toLowerCase(),
    });
    if (lookupError) throw lookupError;
    if (!foundUserId) {
      return NextResponse.json({ error: "Kein Konto mit dieser E-Mail gefunden." }, { status: 404 });
    }
    if (foundUserId === user.id) {
      return NextResponse.json({ error: "Du bist bereits Besitzer dieser Reise." }, { status: 400 });
    }

    const { error: insertError } = await supabase
      .from("trip_members")
      .insert({ trip_id: params.id, user_id: foundUserId });
    if (insertError && insertError.code !== "23505") throw insertError; // 23505 = bereits geteilt

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Teilen fehlgeschlagen:", err);
    return NextResponse.json({ error: `Teilen fehlgeschlagen: ${errorMessage(err)}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { supabase, user, isOwner } = await requireOwner(params.id);
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    if (!isOwner) return NextResponse.json({ error: "Nur der Besitzer kann Freigaben entfernen." }, { status: 403 });

    const { user_id } = (await req.json()) as { user_id?: string };
    if (!user_id) return NextResponse.json({ error: "user_id ist erforderlich." }, { status: 400 });

    const { error } = await supabase
      .from("trip_members")
      .delete()
      .eq("trip_id", params.id)
      .eq("user_id", user_id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Freigabe entfernen fehlgeschlagen:", err);
    return NextResponse.json({ error: `Entfernen fehlgeschlagen: ${errorMessage(err)}` }, { status: 500 });
  }
}
