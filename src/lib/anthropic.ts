import Anthropic from "@anthropic-ai/sdk";

// Wird ausschließlich in app/api/*/route.ts (Server-Code) importiert.
// ANTHROPIC_API_KEY darf niemals in Client-Code oder ans Frontend gelangen.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Vision-fähiges Modell für die Dokumentenextraktion. Für geringere Kosten
// bei einfacheren Dokumenten kann auf ein leichteres Modell gewechselt werden,
// sobald du siehst, wie zuverlässig die Extraktion damit noch funktioniert.
export const EXTRACTION_MODEL = "claude-sonnet-5";

// Für den Chat gegen bereits gespeicherte Reisedaten: die Reisedaten stehen
// als fertiges JSON im Prompt, das Modell muss nur noch daraus antworten
// ("steht das drin oder nicht") - dafür genügt ein kleineres, günstigeres
// Modell, ohne bei der Antwortqualität nennenswert einzubüßen.
export const CHAT_MODEL = "claude-haiku-4-5-20251001";

// Für die Websuche-gestützte Recherche (Schiffsinfos etc.): Haiku unterstützt
// die für web_search benötigten programmatic tool calls nicht, daher Sonnet.
export const RESEARCH_MODEL = "claude-sonnet-5";

// Recherche-Schalter liegen in lib/research-config.ts (ohne SDK-Import, damit
// auch Server-Komponenten sie lesen können) - hier nur weitergereicht, damit
// bestehende Importe aus dieser Datei weiter funktionieren.
export { RESEARCH_ENABLED, RESEARCH_AUTO } from "@/lib/research-config";
