import { NextRequest, NextResponse } from "next/server";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { buildChatSystemPrompt } from "@/lib/prompts";
import { fetchTripContext, serializeTripContext } from "@/lib/trip-context";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Etwas großzügiger als eine reine Textantwort, falls der Nutzer einer
// vertiefenden Recherche zustimmt und das web_search-Tool zum Einsatz kommt.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { trip_id, message } = (await req.json()) as { trip_id?: string; message?: string };

    if (!trip_id || !message?.trim()) {
      return NextResponse.json({ error: "trip_id und message sind erforderlich." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const context = await fetchTripContext(supabase, trip_id);
    if (!context) {
      return NextResponse.json({ error: "Reise nicht gefunden." }, { status: 404 });
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
          text: buildChatSystemPrompt(serializeTripContext(context)),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
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
