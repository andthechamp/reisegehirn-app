import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Speichert eine als wichtig markierte Chat-Antwort in user_memory (Ebene 3
// "Nutzergedächtnis") - source_type 'marked_answer' ist dafür extra im Schema
// vorgesehen. Künftige Chat-Antworten beziehen das als vertrauenswürdigen
// Kontext mit ein, statt dieselbe Sache erneut zu recherchieren.
export async function POST(req: NextRequest) {
  try {
    const { trip_id, content } = (await req.json()) as { trip_id?: string; content?: string };
    if (!trip_id || !content?.trim()) {
      return NextResponse.json({ error: "trip_id und content sind erforderlich." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: inserted, error } = await supabase
      .from("user_memory")
      .insert({ trip_id, content, source_type: "marked_answer" })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ memory: inserted });
  } catch (err) {
    console.error("Merken fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Merken fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
