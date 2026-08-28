// Trägt die fehlende Kategorie 'essen' für Häfen nach, die schon andere
// Pflichtthemen haben und nur noch Essen vermissen (Liste kommt aus
// scripts/scan-research-gaps.ts). Die frühen Seed-Chargen (batch2-6) hatten
// diese Kategorie nie enthalten; genau deshalb hat die alte Automatik für
// jeden dieser Häfen bei JEDEM Laden einer Reise einen neuen Websuche-Lauf
// gestartet. Häfen ohne jedes Pflichtthema (komplett neue Häfen) gehören
// NICHT hierher, sondern in eine vollständige Recherche nach dem
// batch*-Muster.
//
// UNTERSCHIED ZU DEN BATCH-SKRIPTEN: Dieses Skript ist rein additiv. Die
// batch*-Skripte löschen vor dem Einfügen alle curated=false-Zeilen des
// Hafens - das würde hier die bereits vorhandenen Anleger-/Zu-Fuß-/
// Praktisches-Einträge mitreißen. Hier wird nichts gelöscht und nichts
// überschrieben.
//
// ABLAUF:
//   1. scripts/data/port-essen.json öffnen und die content-Felder füllen.
//      Leere Einträge werden übersprungen - du kannst also einen Hafen nach
//      dem anderen füllen und das Skript beliebig oft laufen lassen.
//   2. node --env-file=.env.local scripts/seed-port-essen.ts
//   3. node --env-file=.env.local scripts/scan-research-gaps.ts
//      (schließt die gefüllten Lücken in der Admin-Liste)
//
// FORMAT DES content-FELDS: mehrere eigenständige Tipps mit " • " trennen,
// genau wie in den bestehenden Zeilen (siehe CONTENT_FORMATTING_RULE in
// src/lib/prompts.ts) - die App rendert daraus eine Aufzählung. Beispiel:
//   "Restaurant X am Hafen, ca. 5 Gehminuten vom Terminal, Fischgerichte ab
//    ca. 15 EUR • Markthalle Y mit Ständen für einen schnellen Imbiss •
//    Trinkgeld ist in Dänemark im Preis enthalten"
//
// Kein Anthropic-Aufruf, keine Websuche - reine Redaktion.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

type SourceTier = "1" | "2" | "3";
type Staleness = "zeitlos" | "saisonal" | "verfällt";

interface EssenEintrag {
  // Muss exakt der Schreibweise in port_research/port_calls entsprechen -
  // siehe src/lib/port-names.ts, falls für den Hafen mehrere Varianten
  // existieren. Hier steht immer die kanonische.
  port_name: string;
  title: string;
  content: string;
  source_tier: SourceTier;
  source_name: string;
  source_url: string;
  staleness: Staleness;
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(dirname, "data", "port-essen.json");
const eintraege: EssenEintrag[] = JSON.parse(readFileSync(dataPath, "utf-8"));

// --force überschreibt eine bereits vorhandene essen-Zeile (löscht die alte
// und legt die neue an). Ohne den Schalter bleibt Vorhandenes unangetastet,
// damit ein versehentlicher zweiter Lauf keine Dubletten erzeugt.
const force = process.argv.includes("--force");

function pruefe(e: EssenEintrag): string | null {
  if (!e.port_name?.trim()) return "port_name fehlt";
  if (!e.content?.trim()) return null; // absichtlich leer = noch nicht gefüllt
  if (!e.source_name?.trim()) return "source_name fehlt (woher stammt der Tipp?)";
  if (!["1", "2", "3"].includes(e.source_tier)) return `source_tier "${e.source_tier}" ungültig`;
  if (!["zeitlos", "saisonal", "verfällt"].includes(e.staleness)) return `staleness "${e.staleness}" ungültig`;
  return null;
}

async function main() {
  let eingefuegt = 0;
  let uebersprungenLeer = 0;
  let uebersprungenVorhanden = 0;
  const fehler: string[] = [];

  for (const e of eintraege) {
    const problem = pruefe(e);
    if (problem) {
      fehler.push(`${e.port_name}: ${problem}`);
      continue;
    }

    if (!e.content?.trim()) {
      uebersprungenLeer++;
      continue;
    }

    // Bestehende Zeilen des Hafens laden: für die Dublettenprüfung und um
    // sort_order hinten anzuhängen, statt mit vorhandenen Zeilen zu kollidieren.
    const { data: vorhanden, error: leseFehler } = await supabase
      .from("port_research")
      .select("id, category, sort_order")
      .eq("port_name", e.port_name);
    if (leseFehler) throw leseFehler;

    if ((vorhanden ?? []).length === 0) {
      fehler.push(
        `${e.port_name}: kein einziger Eintrag in port_research - stimmt die Schreibweise? (siehe src/lib/port-names.ts)`
      );
      continue;
    }

    const essenZeilen = (vorhanden ?? []).filter((r) => r.category === "essen");
    if (essenZeilen.length > 0) {
      if (!force) {
        uebersprungenVorhanden++;
        continue;
      }
      const { error: loeschFehler } = await supabase
        .from("port_research")
        .delete()
        .in(
          "id",
          essenZeilen.map((r) => r.id)
        );
      if (loeschFehler) throw loeschFehler;
    }

    const sortOrder = (vorhanden ?? []).reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1) + 1;

    const { error: schreibFehler } = await supabase.from("port_research").insert({
      port_name: e.port_name,
      category: "essen",
      title: e.title?.trim() || e.port_name,
      content: e.content.trim(),
      items: null,
      source_tier: e.source_tier,
      source_name: e.source_name.trim(),
      source_url: e.source_url?.trim() || null,
      staleness: e.staleness,
      sort_order: sortOrder,
      // Redaktionell geschrieben, nicht aus der Websuche - schützt die Zeile
      // davor, von einem späteren batch*-Seed oder Recherche-Lauf für diesen
      // Hafen gelöscht zu werden (die räumen nur curated=false ab).
      curated: true,
    });
    if (schreibFehler) throw schreibFehler;

    console.log(`  + ${e.port_name}`);
    eingefuegt++;
  }

  console.log(`\nEingefügt:              ${eingefuegt}`);
  console.log(`Übersprungen (leer):    ${uebersprungenLeer}`);
  console.log(`Übersprungen (schon da):${uebersprungenVorhanden}${force ? " (--force aktiv, sollte 0 sein)" : ""}`);

  if (fehler.length > 0) {
    console.error(`\nProbleme (${fehler.length}):`);
    for (const f of fehler) console.error(`  ! ${f}`);
    process.exitCode = 1;
  }

  if (eingefuegt > 0) {
    console.log("\nDanach die Lückenliste aktualisieren:");
    console.log("  node --env-file=.env.local scripts/scan-research-gaps.ts");
  }
}

main().catch((err) => {
  console.error("Essen-Seed fehlgeschlagen:", err);
  process.exit(1);
});
