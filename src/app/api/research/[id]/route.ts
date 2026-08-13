import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("research_findings").delete().eq("id", params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Recherche-Eintrag löschen fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Löschen fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
