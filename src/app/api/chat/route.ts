import { NextRequest, NextResponse } from "next/server";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { buildChatSystemPrompt, type ChatLanguage } from "@/lib/prompts";
import { fetchTripContext, serializeTripContext } from "@/lib/trip-context";
import { getCurrentUser } from "@/lib/supabase";

export const runtime = "nodejs";
// Reine Textantwort aus bereits gespeicherten Reisedaten - keine Websuche,
// keine Tool-Runden, daher kurz bemessen.
export const maxDuration = 30;

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
      // Ohne Websuche-Runden ist die Antwort reiner Fließtext zu einer Frage
      // über bereits gespeicherte Daten - 2000 Token reichen dafür reichlich.
      max_tokens: 2000,
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
      // Bewusst ohne Tools: Der Chat antwortet ausschließlich aus dem
      // Reisekontext im System-Prompt (Reisedaten, Recherche-Funde, gemerkte
      // Antworten) und dem bisherigen Verlauf. Websuche zur Laufzeit war der
      // teuerste Teil des Chats und hat außerdem ungeprüfte Funde in die
      // Recherche-Anzeige der Reise geschrieben - beides ist jetzt weg, das
      // Befüllen der Recherche läuft redaktionell (siehe RESEARCH_AUTO in
      // lib/anthropic.ts und die Lückenliste im Admin-Bereich).
      messages,
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error("Die Antwort wurde wegen des Token-Limits abgeschnitten. Bitte erneut versuchen.");
    }

    const textBlocks = response.content.filter((block) => block.type === "text");
    if (textBlocks.length === 0) {
      throw new Error("Keine Textantwort vom Modell erhalten.");
    }
    // Ohne Websuche kommt die Antwort praktisch immer als ein einzelner
    // Text-Block; die Blöcke trotzdem direkt aneinanderhängen (kein
    // zusätzlicher Trenner), falls das Modell doch einmal aufteilt. Mehrfache
    // Leerzeilen aus dem Modelltext auf maximal eine begrenzen.
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
