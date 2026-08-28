// Vierzehnte Charge: 7 südostasiatische Häfen (Singapur, Penang, Kelang/Kuala Lumpur,
// Langkawi, Phuket, Ko Samui, Laem Chabang/Bangkok). Struktur/Logik 1:1 aus den
// vorherigen Batch-Skripten. Rohdaten in scripts/data/port-research-batch14.json.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-batch14.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { canonicalPortName } from "../src/lib/port-names.ts";

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
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "port-research-batch14.json");
const findings: RawFinding[] = JSON.parse(readFileSync(dataPath, "utf-8"));

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
