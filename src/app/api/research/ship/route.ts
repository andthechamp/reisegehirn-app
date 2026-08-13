import { NextRequest, NextResponse } from "next/server";
import { anthropic, RESEARCH_MODEL } from "@/lib/anthropic";
import { buildShipResearchPrompt } from "@/lib/prompts";
import { parseResearchFindings } from "@/lib/research-schema";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Mehrstufige Recherche mit mehreren Suchrunden kann eine Weile dauern -
// großzügiger bemessen als die einfache Extraktion.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, force } = (await req.json()) as { trip_id?: string; force?: boolean };
    if (!trip_id) {
      return NextResponse.json({ error: "trip_id ist erforderlich." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, ship_name")
      .eq("id", trip_id)
      .single();
    if (tripError || !trip) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }

    // Schiffsinfos sind nicht reisespezifisch - vor einer neuen Recherche erst
    // prüfen, ob eine andere Reise auf demselben Schiff schon recherchiert hat.
    // Nur bei explizitem "Erneut recherchieren" (force) wird das übersprungen.
    if (!force) {
      const { data: cached, error: cacheError } = await supabase
        .from("ship_research")
        .select("*")
        .eq("ship_name", trip.ship_name)
        .order("sort_order", { ascending: true });
      if (cacheError) throw cacheError;
      if (cached && cached.length > 0) {
        return NextResponse.json({ findings: cached, cached: true });
      }
    }

    const response = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      // Thinking-Blöcke und Tool-Aufrufe/Suchergebnisse zählen selbst schon
      // gegen dieses Budget, bevor das eigentliche JSON geschrieben wird -
      // bei mehreren Suchrunden reichten 4000 nicht aus (Antwort wurde
      // mitten im JSON abgeschnitten).
      max_tokens: 16000,
      system: buildShipResearchPrompt(trip.ship_name),
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `Recherchiere Informationen zum Kreuzfahrtschiff "${trip.ship_name}".`,
        },
      ],
    });

    // "" statt "\n" als Trenner: ein rohes Zeilenumbruchzeichen mitten in
    // einem JSON-String-Wert wäre ungültiges JSON, falls ein Text-Fragment
    // (bei Websuche mit vielen Zitationen) mitten in einem Feldwert endet.
    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (response.stop_reason === "max_tokens") {
      console.error("Schiffsrecherche: Antwort durch max_tokens abgeschnitten.\nRohtext:\n", rawText);
      return NextResponse.json(
        { error: "Die Recherche wurde wegen des Token-Limits abgeschnitten. Bitte erneut versuchen." },
        { status: 500 }
      );
    }

    const findings = parseResearchFindings(rawText);
    if (findings.length === 0) {
      // Zum Debuggen: alle Content-Block-Typen (zeigt, ob web_search überhaupt
      // aufgerufen wurde) und der volle Text, aus dem das JSON-Array fehlte.
      console.error(
        "Schiffsrecherche: keine Findings geparst. Block-Typen:",
        response.content.map((b) => b.type),
        "\nRohtext:\n", rawText
      );
      return NextResponse.json({ findings: [] });
    }

    // Vor dem Einfügen alte Schiffsinfos für dieses Schiff entfernen, statt sie
    // anzuhäufen - sonst bleiben z. B. Treffer zu einem verwechselten
    // Schwesterschiff aus einem früheren Lauf dauerhaft in der Datenbank.
    const { error: deleteError } = await supabase
      .from("ship_research")
      .delete()
      .eq("ship_name", trip.ship_name);
    if (deleteError) throw deleteError;

    const rows = findings.map((f, i) => ({
      ship_name: trip.ship_name,
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
      .from("ship_research")
      .insert(rows)
      .select();
    if (insertError) throw insertError;

    return NextResponse.json({ findings: inserted ?? [], cached: false });
  } catch (err) {
    console.error("Schiffsrecherche fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
