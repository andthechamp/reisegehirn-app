import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Per Vercel Cron aufgerufen (siehe vercel.json). Schreibt in die Ein-Zeilen-
 * Tabelle keepalive, damit Supabase das Free-Tier-Projekt nicht nach 7 Tagen
 * Inaktivität pausiert. Ein reiner Lesezugriff reicht dafür nicht zuverlässig -
 * deshalb ein echtes UPDATE.
 */
export async function GET(req: NextRequest) {
  // Fail-closed, siehe refresh-ship-research.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Keepalive: CRON_SECRET ist nicht gesetzt, Aufruf wird abgelehnt.");
    return NextResponse.json({ error: "Server nicht korrekt konfiguriert." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: current, error: readError } = await supabase
    .from("keepalive")
    .select("ping_count")
    .eq("id", 1)
    .single();
  if (readError) {
    console.error("Keepalive: Lesen fehlgeschlagen:", readError);
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("keepalive")
    .update({ last_ping: new Date().toISOString(), ping_count: current.ping_count + 1 })
    .eq("id", 1);
  if (error) {
    console.error("Keepalive: Update fehlgeschlagen:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pingCount: current.ping_count + 1 });
}
