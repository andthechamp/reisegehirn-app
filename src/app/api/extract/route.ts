import { NextRequest, NextResponse } from "next/server";
import { anthropic, EXTRACTION_MODEL } from "@/lib/anthropic";
import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/prompts";
import { parseExtractionResult } from "@/lib/extraction-schema";
import { findUnsupportedFile, unsupportedFileTypeMessage, filesToContentBlocks } from "@/lib/document-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Kein Bild hochgeladen." }, { status: 400 });
    }

    const unsupported = findUnsupportedFile(files);
    if (unsupported) {
      return NextResponse.json({ error: unsupportedFileTypeMessage(unsupported) }, { status: 400 });
    }

    const contentBlocks = await filesToContentBlocks(files);

    // PDF-Support (Stand SDK 0.32.0) läuft nur über die Beta-Messages-API.
    // max_tokens großzügig bemessen: bei vielen Reisenden/Kabinen/Hafentagen
    // kann die JSON-Antwort mehrere tausend Tokens umfassen.
    const response = await anthropic.beta.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM_PROMPT,
      betas: ["pdfs-2024-09-25"],
      messages: [
        {
          role: "user",
          content: [
            ...contentBlocks,
            {
              type: "text",
              text: "Extrahiere die Reisedaten aus diesem Dokument gemäß dem vorgegebenen JSON-Schema.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Keine Textantwort vom Modell erhalten.");
    }

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Die Modellantwort wurde wegen des Token-Limits abgeschnitten, bevor gültiges JSON zustande kam. Bitte erneut versuchen oder das Dokument in kleinere Abschnitte aufteilen."
      );
    }

    const result = parseExtractionResult(textBlock.text);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Extraktion fehlgeschlagen:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unbekannter Fehler.";
    return NextResponse.json(
      { error: `Extraktion fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
