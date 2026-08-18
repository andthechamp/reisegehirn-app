// Reduziert einen Kabinentyp aus einer Buchung (z. B. "Balkonkabine
// Kategorie D (4er Belegung)" oder "Balkonkabine Kategorie D (2er Belegung),
// Deck 7 - Hanse") auf die reine Kategorie ("Balkonkabine Kategorie D") -
// Belegung und Deck/Lage variieren pro Buchung, die Kabinenkategorie selbst
// (Größe, Grundriss) aber nicht. Dient als geteilter Cache-Schlüssel für
// ship_research.cabin_category, damit zwei Buchungen derselben Kategorie auf
// demselben Schiff sich eine Recherche teilen, statt doppelt zu suchen.
export function normalizeCabinCategory(cabinType: string): string {
  return cabinType
    .replace(/\([^)]*\)/g, "")
    .split(",")[0]
    .trim();
}

// Bei Kreuzfahrtschiffen kodiert die Kabinennummer üblicherweise das Deck als
// führende Ziffer(n), gefolgt von einer 3-stelligen Kabinennummer auf diesem
// Deck (z. B. "7115" -> Deck 7, Kabine 115). Wird für die deckgenaue
// Kabinenrecherche gebraucht (siehe buildCabinResearchPrompt) - ohne Deck
// würden Lage-/Lärm-Erfahrungsberichte von einem völlig anderen Deck derselben
// Kategorie fälschlich als relevant für die eigene Kabine erscheinen.
export function extractDeckNumber(cabinNumber: string): string | null {
  const digits = cabinNumber.replace(/\D/g, "");
  if (digits.length <= 3) return null;
  const deck = digits.slice(0, -3).replace(/^0+/, "");
  return deck || null;
}

// Baut den Cache-/Anzeige-Schlüssel für ship_research.cabin_category: reine
// Kategorie, oder "Kategorie · Deck N" wenn das Deck bekannt ist. Wird sowohl
// beim Erzeugen der Kabinen-Gruppen (page.tsx) als auch beim Parsen in
// buildCabinResearchPrompt verwendet - eine Stelle für das Format, damit
// beide Seiten nie auseinanderlaufen.
export function cabinLabel(category: string, deck: string | null): string {
  return deck ? `${category} · Deck ${deck}` : category;
}
