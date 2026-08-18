// Routen-/regionsgebundenes Wissen (route_research) hat keine automatische
// Trip->Region-Erkennung - trips.route_name ist Freitext ohne Taxonomie.
// Stattdessen wird eine Reise anhand ihrer port_calls gegen eine kuratiert
// gepflegte Liste bekannter Häfen je Region abgeglichen. Bewusst simpel
// gehalten (keine KI, keine Geo-Koordinaten) - reicht aus, solange die
// Zuordnung nur für redaktionell gepflegte Regionen (aktuell: Karibik/
// Mittelamerika) gebraucht wird.
export const REGION_PORTS: Record<string, string[]> = {
  karibik: [
    "Cozumel",
    "Roatan",
    "Roatán",
    "Puerto Limon",
    "Puerto Limón",
    "Colon",
    "Colón",
    "Cartagena",
    "La Romana",
    "Grand Cayman",
    "Belize City",
    "Belize",
  ],
};

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Liefert alle Regionen, für die mindestens einer der übergebenen Hafennamen
 * in REGION_PORTS auftaucht - z. B. für eine Route mit Halt in "Cozumel"
 * kommt "karibik" zurück. Ein Trip kann (theoretisch) mehreren Regionen
 * zugeordnet sein, praktisch meist genau einer.
 */
export function regionsForPortNames(portNames: string[]): string[] {
  const normalizedCalls = new Set(portNames.map(normalize));
  return Object.entries(REGION_PORTS)
    .filter(([, ports]) => ports.some((p) => normalizedCalls.has(normalize(p))))
    .map(([region]) => region);
}
