/**
 * Erkennt, ob ein Recherche-Text im Kern eine nummerierte Liste ist
 * ("1. Punkt eins 2. Punkt zwei ..."), auch wenn das Modell keine echten
 * Zeilenumbrüche zwischen den Punkten gesetzt hat. Gibt null zurück, wenn
 * kein Listen-Muster erkennbar ist - dann wird der Text als Fließtext angezeigt.
 *
 * Eine im Fließtext erwähnte Zahl wie "17. Jahrhundert" sieht für sich
 * genommen genauso aus wie ein echter Listenpunkt ("N. Text") - das lässt
 * sich nicht an der Zahl selbst unterscheiden, nur an der Reihenfolge: echte
 * Listenpunkte bilden immer exakt die Sequenz 1, 2, 3, ... Deshalb werden
 * alle Kandidaten-Trennstellen gesammelt und nur akzeptiert, wenn ihre Zahlen
 * lückenlos bei 1 beginnend aufsteigen.
 */
export function splitNumberedList(text: string): string[] | null {
  const trimmed = text.trim();
  if (!/^\d+\.\s/.test(trimmed)) return null;

  // Bevorzugt: echte Zeilenumbriche zwischen den Punkten (wie in
  // buildPortResearchPrompt für sehenswuerdigkeiten verlangt).
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines.every((l, i) => new RegExp(`^${i + 1}\\.\\s`).test(l))) {
    return lines.map((l) => l.replace(/^\d+\.\s*/, "").trim());
  }

  // Fallback ohne echte Zeilenumbrüche: Kandidaten sammeln (?<!\d) verhindert
  // dabei zusätzlich, dass "17." selbst als Zahlenlauf "1" + "7." erkannt wird.
  const candidates = [...trimmed.matchAll(/(?<!\d)(\d+)\.\s+/g)];
  if (candidates.length < 2 || !candidates.every((m, i) => Number(m[1]) === i + 1)) {
    return null;
  }

  const parts: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const start = candidates[i].index! + candidates[i][0].length;
    const end = i + 1 < candidates.length ? candidates[i + 1].index! : trimmed.length;
    parts.push(trimmed.slice(start, end).trim());
  }
  return parts.filter(Boolean).length >= 2 ? parts.filter(Boolean) : null;
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

/**
 * Fallback für Recherche-Text ohne erkennbare Listen-Struktur: trennt lange
 * Fließtext-Absätze in einzelne Sätze auf, damit sie nicht als ein
 * ununterbrochener Textblock erscheinen. Split nur nach Satzzeichen + Leerzeichen
 * + Großbuchstabe, damit Abkürzungen ("bzw.", "z. B.", "ca. 5 Euro") nicht
 * fälschlich einen Satz beenden.
 */
export function splitSentences(text: string): string[] | null {
  const trimmed = text.trim();
  const parts = trimmed
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts : null;
}
