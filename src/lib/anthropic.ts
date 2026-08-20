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

// Für die Websuche-gestützte Recherche (Schiffsinfos etc.): temporär auf das
// günstigste Modell umgestellt, da die Recherche aktuell ohnehin über
// RESEARCH_ENABLED abgeschaltet ist (siehe unten) - falls doch mal ein Pfad
// durchrutscht, soll er nicht mit dem teuren Modell laufen.
export const RESEARCH_MODEL = "claude-haiku-4-5-20251001";

// Schalter für die komplette Websuche-Recherche (Schiff/Kabine/Hafen, manuell
// wie automatisch beim Laden einer Reise, sowie der tägliche Refresh-Cron).
// Aktuell deaktiviert, weil die Recherche zu viele Tokens verbraucht hat -
// Häfen/Schiffe werden stattdessen parallel manuell recherchiert und direkt
// in die Datenbank eingetragen. Der Chat (CHAT_MODEL) ist davon nicht
// betroffen und bleibt aktiv. Zum Wiedereinschalten einfach auf true setzen.
export const RESEARCH_ENABLED = false;
