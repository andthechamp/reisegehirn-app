// Einmaliges Seed-Skript für eine sechste Charge extern recherchierter
// Hafeninformationen (Südliches Afrika & Marokko/Gibraltar), NICHT
// Teil der laufenden App. Format entspricht exakt dem ResearchFinding-Schema
// aus der KI-Websuche-Recherche (siehe port-research.ts/research-schema.ts).
// Rohdaten liegen in scripts/data/port-research-batch6.json - Struktur/Logik
// 1:1 aus seed-port-research-batch3.ts übernommen.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-batch6.ts
//
// Schiffsunabhängige Kategorien (SHARED_PORT_CATEGORIES) landen als
// curated=false in port_research - genau wie ein echter KI-Rechercheanruf,
// damit sie beim nächsten Anlauf ganz normal per TTL neu recherchiert werden
// können. ausflug_privat/ausflug_offiziell sind laut Schema NICHT teilbar
// (Reederei-Angebote unterscheiden sich) - ausflug_offiziell wird daher hier
// auf ausflug_privat abgebildet (Inhalte sind generische, nicht
// reedereigebundene Ausflugstipps) und wie in seed-curated-tips.ts als
// curated=true gespeichert, damit es nicht beim nächsten KI-Rechercheanruf
// für den Hafen gelöscht wird.

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

type SourceTier = "A" | "B" | "C";
type Staleness = "zeitlos" | "saisonal" | "verfällt";

interface SightItem {
  name: string;
  description: string;
}

interface RawFinding {
  category: string;
  title: string;
  content: string;
  items?: SightItem[];
  source_tier: SourceTier;
  source_name: string;
  source_url: string;
  staleness: Staleness;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "port-research-batch6.json");
const findings: RawFinding[] = JSON.parse(readFileSync(dataPath, "utf-8"));

// Keine Kollisionen mit bereits kanonisierten Häfen aus früheren Chargen
// gefunden - alle Titel dieser Charge sind eigenständige, neue Häfen.
const PORT_NAME_MAP: Record<string, string> = {};

const SHARED_CATEGORIES = new Set([
  "anleger",
  "zu_fuss",
  "essen",
  "praktisches",
  "sehenswuerdigkeiten",
  "wetter_packen",
  "sonstiges",
]);

function canonicalPortName(rawTitle: string): string {
  return PORT_NAME_MAP[rawTitle] ?? rawTitle;
}

async function seedShared() {
  const byPort = new Map<string, RawFinding[]>();
  for (const f of findings) {
    if (!SHARED_CATEGORIES.has(f.category)) continue;
    const portName = canonicalPortName(f.title);
    if (!byPort.has(portName)) byPort.set(portName, []);
    byPort.get(portName)!.push(f);
  }

  for (const [portName, rows] of byPort) {
    const { error: deleteError } = await supabase
      .from("port_research")
      .delete()
      .eq("port_name", portName)
      .eq("curated", false);
    if (deleteError) throw deleteError;

    const insertRows = rows.map((f, i) => ({
      port_name: portName,
      category: f.category,
      title: portName,
      content: f.content,
      items: f.items ?? null,
      source_tier: f.source_tier,
      source_name: f.source_name,
      source_url: f.source_url,
      staleness: f.staleness,
      sort_order: i,
      curated: false,
    }));
    const { error: insertError } = await supabase.from("port_research").insert(insertRows);
    if (insertError) throw insertError;
    console.log(`port_research (curated=false): ${portName} - ${rows.length} Zeilen`);
  }
}

async function seedCuratedExcursions() {
  const curated = findings
    .filter((f) => f.category === "ausflug_privat" || f.category === "ausflug_offiziell")
    .map((f) => ({ ...f, category: "ausflug_privat" as const, port_name: canonicalPortName(f.title) }));

  for (const f of curated) {
    const { error: deleteError } = await supabase
      .from("port_research")
      .delete()
      .eq("port_name", f.port_name)
      .eq("category", f.category)
      .eq("title", f.port_name)
      .eq("curated", true);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("port_research").insert({
      port_name: f.port_name,
      category: f.category,
      title: f.port_name,
      content: f.content,
      source_tier: f.source_tier,
      source_name: f.source_name,
      source_url: f.source_url,
      staleness: f.staleness,
      curated: true,
    });
    if (insertError) throw insertError;
    console.log(`port_research (curated=true): ${f.port_name} - ${f.category}`);
  }
}

async function main() {
  await seedShared();
  await seedCuratedExcursions();
  console.log("Fertig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
