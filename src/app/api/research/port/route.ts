import { NextRequest, NextResponse } from "next/server";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildPortResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Mehrstufige Recherche mit mehreren Suchrunden kann eine Weile dauern -
// großzügiger bemessen als die einfache Extraktion.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, port_call_id } = (await req.json()) as {
      trip_id?: string;
      port_call_id?: string;
    };
    if (!trip_id || !port_call_id) {
      return NextResponse.json({ error: "trip_id und port_call_id sind erforderlich." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const [{ data: trip, error: tripError }, { data: portCall, error: portCallError }] = await Promise.all([
      supabase.from("trips").select("id, ship_name").eq("id", trip_id).single(),
      supabase.from("port_calls").select("id, port_name, call_date, is_sea_day").eq("id", port_call_id).single(),
    ]);
    if (tripError || !trip) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }
    if (portCallError || !portCall) {
      return NextResponse.json({ error: "Hafenanlauf nicht gefunden." }, { status: 404 });
    }
    if (portCall.is_sea_day) {
      return NextResponse.json({ error: "An einem Seetag gibt es keinen Hafen zu recherchieren." }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      // Thinking-Blöcke und Tool-Aufrufe/Suchergebnisse zählen selbst schon
      // gegen dieses Budget, bevor das eigentliche JSON geschrieben wird -
      // siehe gleiches Problem bei /api/research/ship.
      max_tokens: 16000,
      system: buildPortResearchPrompt(trip.ship_name, portCall.port_name, portCall.call_date),
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `Recherchiere Informationen zum Hafenanlauf in "${portCall.port_name}" am ${portCall.call_date}.`,
        },
      ],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (response.stop_reason === "max_tokens") {
      console.error("Hafenrecherche: Antwort durch max_tokens abgeschnitten.\nRohtext:\n", rawText);
      return NextResponse.json(
        { error: "Die Recherche wurde wegen des Token-Limits abgeschnitten. Bitte erneut versuchen." },
        { status: 500 }
      );
    }

    const findings = parseResearchFindings(rawText);
    if (findings.length === 0) {
      console.error(
        "Hafenrecherche: keine Findings geparst. Block-Typen:",
        response.content.map((b) => b.type),
        "\nRohtext:\n", rawText
      );
      return NextResponse.json({ findings: [] });
    }

    // Vor dem Einfügen alte Recherche zu diesem Hafenanlauf entfernen, statt
    // sie anzuhäufen - gleiches Muster wie bei der Schiffsrecherche.
    const { error: deleteError } = await supabase
      .from("research_findings")
      .delete()
      .eq("trip_id", trip_id)
      .eq("port_call_id", port_call_id);
    if (deleteError) throw deleteError;

    const rows = findings.map((f, i) => ({
      trip_id,
      port_call_id,
      category: f.category,
      title: f.title,
      content: f.content,
      source_tier: f.source_tier,
      source_name: f.source_name,
      source_url: f.source_url,
      staleness: f.staleness,
      sort_order: i,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("research_findings")
      .insert(rows)
      .select();
    if (insertError) throw insertError;

    return NextResponse.json({ findings: inserted ?? [] });
  } catch (err) {
    console.error("Hafenrecherche fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
