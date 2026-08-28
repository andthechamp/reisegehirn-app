// Achte Charge extern recherchierter Hafeninformationen (87 bereits
// bekannte Häfen, überwiegend zur Auffrischung/Vervollständigung von
// anleger/zu_fuss/essen/praktisches/sehenswuerdigkeiten sowie ergänzenden
// ausflug_privat/ausflug_offiziell-Tipps). Rohdaten liegen in
// scripts/data/port-research-batch8.json - Struktur/Logik aus
// seed-port-research-batch7.ts übernommen, mit zwei Anpassungen:
//
// 1. Die Charge betrifft überwiegend BEREITS geseedete Häfen. Ein blindes
//    "alle curated=false-Zeilen des Hafens löschen" (wie in batch7, das nur
//    komplett neue Häfen befüllte) würde dort auch wetter_packen/sonstiges
//    mitreißen, die diese Charge gar nicht liefert. Gelöscht wird daher nur
//    innerhalb der tatsächlich gelieferten Kategorien.
// 2. Manche Häfen (Greenock, Southampton) liefern sowohl ausflug_offiziell
//    als auch ausflug_privat - beide werden wie in batch7 auf ausflug_privat
//    abgebildet, aber als ZWEI Zeilen behalten (einzeln UND gemeinsam
//    gelöscht+eingefügt), statt sich beim zweiten Insert gegenseitig zu
//    überschreiben.
//
// Quellen-Tier-Werte kommen in dieser Charge teils noch im alten
// A/B/C-Schema, teils schon im neuen 1/2/3-Schema (siehe TIER_SYSTEM_RULE in
// src/lib/prompts.ts) - werden hier einheitlich auf 1/2/3 abgebildet.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-batch8.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { canonicalPortName as libCanonicalPortName } from "../src/lib/port-names.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

type RawSourceTier = "1" | "2" | "3" | "A" | "B" | "C";
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
  source_tier: RawSourceTier;
  source_name: string;
  source_url: string;
  tier_note?: string | null;
  confirmed_by?: string[] | null;
  staleness: Staleness;
  note?: string; // rein editorielle Randbemerkung der Recherche, wird nicht gespeichert
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "port-research-batch8.json");
const findings: RawFinding[] = JSON.parse(readFileSync(dataPath, "utf-8"));

// Schreibweisen dieser Charge, die von den bereits in port-names.ts
// gepflegten Gruppen abweichen und dort keine automatische Kanonisierung
// erfahren (Akzent-Variante bzw. abweichender Klammerzusatz gegenüber dem
// bereits vorhandenen Bestand) - siehe port-names.ts für die Begründung,
// warum das eine kuratierte statt eine erratene Liste ist.
const PORT_NAME_MAP: Record<string, string> = {
  "Coxen Hole (Roatán)": "Coxen Hole (Roatan)",
  "George Town (Grand Cayman)": "Grand Cayman",
};

function canonicalPortName(rawTitle: string): string {
  return libCanonicalPortName(PORT_NAME_MAP[rawTitle] ?? rawTitle);
}

const TIER_MAP: Record<RawSourceTier, "1" | "2" | "3"> = {
  "1": "1",
  "2": "2",
  "3": "3",
  A: "1",
  B: "2",
  C: "3",
};

const SHARED_CATEGORIES = new Set(["anleger", "zu_fuss", "essen", "praktisches", "sehenswuerdigkeiten"]);

function nextSortOrder(rows: { sort_order: number | null }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1) + 1;
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
    const categories = [...new Set(rows.map((r) => r.category))];

    const { data: existing, error: selectError } = await supabase
      .from("port_research")
      .select("id, category, sort_order, curated")
      .eq("port_name", portName);
    if (selectError) throw selectError;

    const toDelete = (existing ?? []).filter((r) => !r.curated && categories.includes(r.category));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("port_research")
        .delete()
        .in(
          "id",
          toDelete.map((r) => r.id)
        );
      if (deleteError) throw deleteError;
    }

    let sortOrder = nextSortOrder((existing ?? []).filter((r) => !toDelete.includes(r)));
    const insertRows = rows.map((f) => ({
      port_name: portName,
      category: f.category,
      title: portName,
      content: f.content,
      items: f.items ?? null,
      source_tier: TIER_MAP[f.source_tier],
      source_name: f.source_name,
      source_url: f.source_url,
      tier_note: f.tier_note ?? null,
      confirmed_by: f.confirmed_by ?? null,
      staleness: f.staleness,
      sort_order: sortOrder++,
      curated: false,
    }));
    const { error: insertError } = await supabase.from("port_research").insert(insertRows);
    if (insertError) throw insertError;
    console.log(`port_research (curated=false): ${portName} - ${rows.length} Zeilen (${categories.join(", ")})`);
  }
}

async function seedCuratedExcursions() {
  const byPort = new Map<string, RawFinding[]>();
  for (const f of findings) {
    if (f.category !== "ausflug_privat" && f.category !== "ausflug_offiziell") continue;
    const portName = canonicalPortName(f.title);
    if (!byPort.has(portName)) byPort.set(portName, []);
    byPort.get(portName)!.push(f);
  }

  for (const [portName, rows] of byPort) {
    const { error: deleteError } = await supabase
      .from("port_research")
      .delete()
      .eq("port_name", portName)
      .eq("category", "ausflug_privat")
      .eq("title", portName)
      .eq("curated", true);
    if (deleteError) throw deleteError;

    const insertRows = rows.map((f, i) => ({
      port_name: portName,
      category: "ausflug_privat" as const,
      title: portName,
      content: f.content,
      source_tier: TIER_MAP[f.source_tier],
      source_name: f.source_name,
      source_url: f.source_url,
      tier_note: f.tier_note ?? null,
      confirmed_by: f.confirmed_by ?? null,
      staleness: f.staleness,
      sort_order: i,
      curated: true,
    }));
    const { error: insertError } = await supabase.from("port_research").insert(insertRows);
    if (insertError) throw insertError;
    console.log(`port_research (curated=true): ${portName} - ${rows.length} Zeile(n)`);
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
