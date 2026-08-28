// Einmaliges Aufräum-Skript: entfernt exakte Duplikate in port_research, die
// dadurch entstanden sind, dass derselbe Inhalt unter zwei Namensvarianten
// desselben Hafens abgelegt wurde (z. B. "Montego Bay" UND "Montego Bay
// (Jamaika)" - siehe PORT_NAME_GROUPS unten, gespiegelt aus
// src/lib/port-names.ts). Die Wissenssuche schlägt beide Varianten nach
// (portNameVariants()), zeigt bei doppelt abgelegtem Inhalt also beide Zeilen
// an. Nur Gruppen mit exakt gleichem (kanonischer Hafenname, category,
// content) gelten als Duplikat - unterschiedliche Inhalte (z. B. mehrere
// Ausflugstipps derselben Kategorie) bleiben unangetastet. Behalten wird pro
// Gruppe die älteste Zeile (retrieved_at), gelöscht werden die jüngeren
// Kopien - unabhängig davon, unter welcher Namensvariante sie liegen.
//
// Aufruf:
//   node --env-file=.env.local scripts/dedupe-port-research.ts          (Trockenlauf, löscht nichts)
//   node --env-file=.env.local scripts/dedupe-port-research.ts --apply  (löscht wirklich)

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

const APPLY = process.argv.includes("--apply");

// Spiegelt PORT_NAME_GROUPS aus src/lib/port-names.ts (siehe dort, warum es
// eine kuratierte Liste ist und keine automatische Normalisierung). Skripte
// laufen ohne den Next-Pfad-Alias "@/", daher dupliziert statt importiert -
// analog zu scripts/scan-research-gaps.ts.
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
  // getrennt - zwei echte, verschiedene Häfen (siehe src/lib/port-names.ts).
];
const CANONICAL_BY_NAME = new Map<string, string>();
for (const group of PORT_NAME_GROUPS) {
  for (const name of group) CANONICAL_BY_NAME.set(name, group[0]);
}
const canonicalPortName = (name: string) => CANONICAL_BY_NAME.get(name) ?? name;

interface Row {
  id: string;
  port_name: string;
  category: string;
  content: string;
  retrieved_at: string;
  curated: boolean;
}

async function main() {
  // Seitenweise laden statt einem einzelnen .select(): Supabase deckelt eine
  // Antwort standardmäßig auf 1000 Zeilen, port_research hat längst mehr -
  // ohne Paginierung blieben die zuletzt recherchierten Häfen komplett
  // ungeprüft, weil sie hinter der 1000er-Grenze lagen.
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from("port_research")
      .select("id, port_name, category, content, retrieved_at, curated")
      .order("retrieved_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((page ?? []) as Row[]));
    if (!page || page.length < 1000) break;
  }

  // Fall 1: wortidentischer Inhalt unter zwei Namensvarianten desselben
  // Hafens (siehe oben, z. B. Montego Bay-Fall).
  const contentGroups = new Map<string, Row[]>();
  for (const row of (rows ?? []) as Row[]) {
    const key = `${canonicalPortName(row.port_name)}|${row.category}|${row.content}`;
    if (!contentGroups.has(key)) contentGroups.set(key, []);
    contentGroups.get(key)!.push(row);
  }

  const toDelete: Row[] = [];
  const deletedIds = new Set<string>();
  for (const group of contentGroups.values()) {
    if (group.length <= 1) continue;
    // Bereits nach retrieved_at aufsteigend sortiert (siehe Query oben) -
    // erste Zeile ist die älteste und bleibt erhalten.
    for (const row of group.slice(1)) {
      toDelete.push(row);
      deletedIds.add(row.id);
    }
  }

  // Fall 2: Race Condition beim automatischen Recherche-Lauf (siehe
  // src/lib/port-research.ts, "existiert schon?"-Prüfung ohne Sperre) -
  // zwei parallele Läufe legen beide eine Zeile an, mit leicht
  // unterschiedlichem Inhalt (z. B. Wetterwerte aus zwei Berechnungen).
  // Nur curated=false betroffen: kuratierte Kategorien wie ausflug_privat
  // dürfen bewusst mehrere Einträge pro (Hafen, Kategorie) haben.
  const autoGroups = new Map<string, Row[]>();
  for (const row of (rows ?? []) as Row[]) {
    if (row.curated || deletedIds.has(row.id)) continue;
    const key = `${canonicalPortName(row.port_name)}|${row.category}`;
    if (!autoGroups.has(key)) autoGroups.set(key, []);
    autoGroups.get(key)!.push(row);
  }
  for (const group of autoGroups.values()) {
    if (group.length <= 1) continue;
    for (const row of group.slice(1)) {
      toDelete.push(row);
      deletedIds.add(row.id);
    }
  }

  console.log(`Geprüfte Zeilen:        ${rows?.length ?? 0}`);
  console.log(`Zu löschende Zeilen:    ${toDelete.length}`);

  if (toDelete.length === 0) return;

  const byPort = new Map<string, number>();
  for (const row of toDelete) {
    byPort.set(row.port_name, (byPort.get(row.port_name) ?? 0) + 1);
  }
  console.log("\nBetroffene Häfen:");
  for (const [port, count] of [...byPort.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${port.padEnd(28)} ${count} Duplikate`);
  }

  if (!APPLY) {
    console.log("\nTrockenlauf - keine Zeile gelöscht. Mit --apply wirklich löschen.");
    return;
  }

  const { error: deleteError } = await supabase
    .from("port_research")
    .delete()
    .in("id", toDelete.map((r) => r.id));
  if (deleteError) throw deleteError;

  console.log(`\n${toDelete.length} doppelte Zeilen gelöscht.`);
}

main().catch((err) => {
  console.error("Dedupe fehlgeschlagen:", err);
  process.exit(1);
});
