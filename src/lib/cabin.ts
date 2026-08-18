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
