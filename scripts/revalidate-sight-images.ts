// Vollständiger Re-Check ALLER Sehenswürdigkeiten-Bilder (nicht nur der
// fehlenden wie backfill-sight-images.ts) - nötig, weil lookupSightImage()
// jetzt Stadt-Disambiguierung verlangt (siehe wikimedia.ts matchesCity) und
// frühere Läufe ohne diese Prüfung teils falsche, aber gefüllte Bilder
// gespeichert haben (z. B. Kiel "Alter Botanischer Garten" -> Tübingen statt
// Kiel). Läuft daher über JEDES Item, nicht nur über image_url === null.
//
// Aufruf:
//   node --env-file=.env.local scripts/revalidate-sight-images.ts

import { createClient } from "@supabase/supabase-js";
import { googleSearchUrl, lookupSightImage } from "../src/lib/wikimedia.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

const DELAY_MS = 1500;

interface SightItem {
  name: string;
  description?: string;
  image_url?: string | null;
  image_source?: string | null;
  article_url?: string | null;
  attribution?: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { data: rows, error } = await supabase
    .from("port_research")
    .select("id, port_name, items")
    .eq("category", "sehenswuerdigkeiten")
    .order("port_name", { ascending: true });
  if (error) throw error;

  const totalItems = (rows ?? []).reduce((sum, r) => sum + (Array.isArray(r.items) ? (r.items as SightItem[]).length : 0), 0);
  console.log(`Häfen: ${rows?.length ?? 0}, Sehenswürdigkeiten gesamt: ${totalItems}\n`);

  let done = 0;
  let corrected = 0; // hatte ein Bild, bekommt jetzt ein anderes (Fehltreffer korrigiert)
  let cleared = 0; // hatte ein Bild, das jetzt als nicht verifizierbar verworfen wird
  let filled = 0; // hatte keins, hat jetzt eins
  let stillMissing = 0;
  const bySource: Record<string, number> = {};

  for (const row of rows ?? []) {
    const items = (row.items as SightItem[]) ?? [];
    if (items.length === 0) continue;
    let changed = false;
    const updatedItems: SightItem[] = [];
    for (const item of items) {
      const before = item.image_url ?? null;
      const lookup = await lookupSightImage(item.name, row.port_name as string);
      done++;
      const after = lookup.url;
      if (after !== before) {
        changed = true;
        if (before && after) corrected++;
        else if (before && !after) cleared++;
        else if (!before && after) filled++;
      }
      if (after) bySource[lookup.source ?? "?"] = (bySource[lookup.source ?? "?"] ?? 0) + 1;
      else stillMissing++;
      updatedItems.push({
        ...item,
        image_url: after,
        image_source: lookup.source,
        article_url: lookup.articleUrl ?? item.article_url ?? googleSearchUrl(`${item.name} ${row.port_name}`),
        attribution: lookup.attribution,
      });
      await sleep(DELAY_MS);
    }

    if (changed) {
      const { error: updateError } = await supabase.from("port_research").update({ items: updatedItems }).eq("id", row.id);
      if (updateError) {
        console.error(`  Update fehlgeschlagen (${row.port_name}):`, updateError.message);
        continue;
      }
    }

    console.log(`${(row.port_name as string).padEnd(30)} (${done}/${totalItems} geprüft)`);
  }

  console.log(
    `\nFertig: ${filled} neu gefüllt, ${corrected} korrigiert (falsches Bild ersetzt), ${cleared} verworfen (nicht mehr verifizierbar), ${stillMissing} weiterhin ohne Bild.`
  );
  console.log(`Quellen: ${JSON.stringify(bySource)}`);
}

main().catch((err) => {
  console.error("Re-Check fehlgeschlagen:", err);
  process.exit(1);
});
