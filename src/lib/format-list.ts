/**
 * Erkennt, ob ein Recherche-Text im Kern eine nummerierte Liste ist
 * ("1. Punkt eins 2. Punkt zwei ..."), auch wenn das Modell keine echten
 * Zeilenumbrüche zwischen den Punkten gesetzt hat. Gibt null zurück, wenn
 * kein Listen-Muster erkennbar ist - dann wird der Text als Fließtext angezeigt.
 */
export function splitNumberedList(text: string): string[] | null {
  const trimmed = text.trim();
  if (!/^\d+\.\s/.test(trimmed)) return null;

  const parts = trimmed
    .split(/\s*(?=\d+\.\s)/)
    .map((p) => p.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts : null;
}

/**
 * Erkennt Aufzählungen, bei denen das Modell einzelne Fakten/Tipps mit "•"
 * getrennt hat (angewiesene Konvention für Kategorien wie wetter_packen,
 * praktisches etc.). Robuster als auf "\n" zu vertrauen, da Zeilenumbrüche
 * beim Modell öfter verloren gehen als das Trennzeichen selbst.
 */
export function splitBulletList(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed.includes("•")) return null;

  const parts = trimmed
    .split(/\s*(?=•)/)
    .map((p) => p.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts : null;
}
