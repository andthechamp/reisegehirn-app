import { NextRequest, NextResponse } from "next/server";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { buildChatSystemPrompt, type ChatLanguage } from "@/lib/prompts";
import { fetchTripContext, serializeTripContext } from "@/lib/trip-context";
import { getCurrentUser } from "@/lib/supabase";

export const runtime = "nodejs";
// Etwas großzügiger als eine reine Textantwort, da Fragen ohne ausreichende
// Datenbasis direkt (ohne separate Rückfrage) das web_search-Tool auslösen.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, message } = (await req.json()) as { trip_id?: string; message?: string };

    if (!trip_id || !message?.trim()) {
      return NextResponse.json({ error: "trip_id und message sind erforderlich." }, { status: 400 });
    }

    const { supabase, user } = await getCurrentUser();

    const context = await fetchTripContext(supabase, trip_id);
    if (!context) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
    }

    let chatLanguage: ChatLanguage = "de";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("chat_language")
        .eq("id", user.id)
        .single();
      if (profile?.chat_language === "vi") chatLanguage = "vi";
    }

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("trip_id", trip_id)
      .order("created_at", { ascending: true });
    if (historyError) throw historyError;

    const historyMessages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

    // Cache-Breakpoint ans Ende der bisherigen Historie setzen: bei der
    // nächsten Nachricht in diesem Gespräch ist dieser komplette Präfix
    // (System-Prompt + bisheriger Verlauf) schon gecacht und muss nicht neu
    // verarbeitet werden - bei wachsender Historie sonst der größte Kostentreiber.
    const messages: Array<{
      role: "user" | "assistant";
      content: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
    }> = [...historyMessages, { role: "user" as const, content: message }];
    if (historyMessages.length > 0) {
      const breakpointIndex = historyMessages.length - 1;
      messages[breakpointIndex] = {
        role: messages[breakpointIndex].role,
        content: [
          { type: "text", text: messages[breakpointIndex].content as string, cache_control: { type: "ephemeral" } },
        ],
      };
    }

    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      // Thinking/Tool-Blöcke bei einer vertiefenden Recherche zählen selbst
      // schon gegen dieses Budget, siehe gleiches Problem bei /api/research/ship.
      max_tokens: 6000,
      // System-Prompt (inkl. komplettem Reisekontext als JSON) ändert sich
      // innerhalb desselben Gesprächs meist nicht - als Cache-Breakpoint
      // markieren, damit er nicht bei jeder Nachricht neu verarbeitet wird.
      system: [
        {
          type: "text",
          text: buildChatSystemPrompt(serializeTripContext(context), chatLanguage),
          cache_control: { type: "ephemeral" },
        },
      ],
      // CHAT_MODEL (Haiku) unterstützt kein programmatic tool calling -
      // ohne explizites allowed_callers lehnt die API web_search mit 400 ab.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_callers: ["direct"] }],
      messages,
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error("Die Antwort wurde wegen des Token-Limits abgeschnitten. Bitte erneut versuchen.");
    }

    const textBlocks = response.content.filter((block) => block.type === "text");
    if (textBlocks.length === 0) {
      throw new Error("Keine Textantwort vom Modell erhalten.");
    }
    // Bei Websuche mit vielen Zitationen zerlegt das Modell seine Antwort oft
    // in viele kleine Text-Fragmente (ein Fragment pro zitiertem Satz). Direkt
    // aneinanderhängen (kein zusätzlicher Trenner) statt mit \n\n zu verbinden,
    // sonst summieren sich daraus viele Leerzeilen. Mehrfache Leerzeilen, die
    // aus dem Modelltext selbst kommen, zusätzlich auf maximal eine begrenzen.
    const reply = textBlocks
      .map((b) => b.text)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Beide Nachrichten erst nach erfolgreicher Modellantwort speichern, damit
    // bei einem Fehler kein Nutzer-Turn ohne Antwort in der Historie hängen bleibt.
    const { error: insertError } = await supabase.from("messages").insert([
      { trip_id, role: "user", content: message },
      { trip_id, role: "assistant", content: reply },
    ]);
    if (insertError) throw insertError;

    // Hat das Modell laut Prompt-Regel 9 für diese Antwort das web_search-Tool
    // genutzt (erkennbar an einem server_tool_use-Block), war die vorhandene
    // Reisedaten-JSON (research/route_research/memory) für die Frage nicht
    // ausreichend. Das Ergebnis zusätzlich als research_findings-Zeile
    // ablegen, damit dieselbe oder eine ähnliche Frage in dieser Reise künftig
    // direkt aus dem Kontext beantwortet werden kann, statt erneut zu suchen -
    // sichtbar wird der Fund dadurch außerdem im Recherche-Bereich der App,
    // nicht nur im Chatverlauf. Rein informativ, kein kritischer Pfad: ein
    // Fehler hier darf die eigentliche Chat-Antwort nicht verhindern.
    const usedWebSearch = response.content.some(
      (block) => block.type === "server_tool_use" && block.name === "web_search"
    );
    if (usedWebSearch) {
      const { error: findingError } = await supabase.from("research_findings").insert({
        trip_id,
        port_call_id: null,
        category: "sonstiges",
        title: message.trim().slice(0, 200),
        content: reply,
        source_tier: "C",
        source_name: null,
        source_url: null,
        staleness: "verfällt",
      });
      if (findingError) {
        console.error("Chat-Recherche konnte nicht als Fund gespeichert werden:", findingError);
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Chat fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
