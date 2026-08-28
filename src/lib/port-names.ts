// Derselbe Hafen taucht je nach Quelle unterschiedlich geschrieben auf: Die
// Reiseverlauf-Extraktion übernimmt die Schreibweise aus dem Dokument der
// Reederei ("Colon", "Coxen Hole (Roatan)"), redaktionelle Seed-Skripte die
// aus der Recherchequelle ("Colón", "Roatán"). Da port_research per exaktem
// port_name nachgeschlagen wird, sah die App vorhandenes Wissen dadurch nicht
// und hat es teuer neu recherchiert - für dieselbe Stadt, bei jedem Laden.
//
// BEWUSST eine kuratierte Liste statt automatischer Normalisierung: Akzente
// und Klammerzusätze pauschal wegzuwerfen würde "Cartagena" (Kolumbien) und
// "Cartagena (Spanien)" zu einem Hafen verschmelzen - zwei echte, verschiedene
// Häfen im Bestand. Ein falscher Treffer wäre schlimmer als ein verpasster:
// er schreibt spanische Anlegerinfos in eine Karibikreise. Neue Varianten
// gehören daher hier von Hand ergänzt, nicht erraten.
//
// Erster Eintrag jeder Gruppe = kanonische Schreibweise. Kanonisch ist jeweils
// die Form, die in port_calls steht, also die, die aus den Reiseunterlagen
// kommt - neu recherchiertes Wissen wird darunter abgelegt, damit künftige
// Reisen es ohne Umweg finden.
const PORT_NAME_GROUPS: string[][] = [
  ["Colon", "Colón"],
  ["Puerto Limon", "Puerto Limón"],
  ["Montego Bay (Jamaika)", "Montego Bay"],
  ["Ocho Rios (Jamaika)", "Ocho Rios"],
  ["Coxen Hole (Roatan)", "Roatán", "Roatan"],
  ["Alesund", "Ålesund"],
  ["Geiranger (Geirangerfjord)", "Geiranger"],
  ["Abu Dhabi (VAE)", "Abu Dhabi"],
  ["Agadir (Marokko)", "Agadir"],
  ["Busan (Südkorea)", "Busan"],
  ["Doha (Katar)", "Doha"],
  ["Dubai (VAE)", "Dubai"],
  ["Durban (Südafrika)", "Durban"],
  ["Honningsvåg (Nordkap)", "Honningsvåg"],
  ["Kapstadt (Südafrika)", "Kapstadt"],
  ["Khasab (Oman)", "Khasab"],
  ["Osaka (Japan)", "Osaka"],
  ["Sir Bani Yas (VAE)", "Sir Bani Yas"],
  ["Tanger (Marokko)", "Tanger"],
  ["Tokio (Japan)", "Tokio"],
  // "Cartagena" (Kolumbien) und "Cartagena (Spanien)" bleiben ABSICHTLICH
  // getrennt - siehe Kommentar oben, das ist der Musterfall dafür.
];

const VARIANTS_BY_NAME = new Map<string, string[]>();
const CANONICAL_BY_NAME = new Map<string, string>();

for (const group of PORT_NAME_GROUPS) {
  for (const name of group) {
    // Eine Schreibweise darf nur zu einer Gruppe gehören - sonst wäre
    // unbestimmt, welcher Hafen gemeint ist, und die Liste würde still das
    // Falsche tun. Lieber beim Start laut scheitern als im Betrieb leise.
    if (VARIANTS_BY_NAME.has(name)) {
      throw new Error(`Hafenname "${name}" steht in mehreren Gruppen in port-names.ts.`);
    }
    VARIANTS_BY_NAME.set(name, group);
    CANONICAL_BY_NAME.set(name, group[0]);
  }
}

/**
 * Alle bekannten Schreibweisen dieses Hafens, inklusive der übergebenen.
 * Für Lookups gedacht: statt .eq("port_name", name) ein
 * .in("port_name", portNameVariants(name)). Ist der Name unbekannt, kommt er
 * als einziger Eintrag zurück - der Aufrufer braucht keine Sonderbehandlung.
 */
export function portNameVariants(portName: string): string[] {
  return VARIANTS_BY_NAME.get(portName) ?? [portName];
}

/**
 * Die Schreibweise, unter der neues Wissen zu diesem Hafen gespeichert werden
 * soll. Für unbekannte Namen der Name selbst.
 */
export function canonicalPortName(portName: string): string {
  return CANONICAL_BY_NAME.get(portName) ?? portName;
}
