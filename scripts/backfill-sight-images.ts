// Trägt fehlende Bilder bei bereits recherchierten Sehenswürdigkeiten nach.
// Der eigentlich dafür vorgesehene Weg - der automatische Nachtrag in
// researchAndSavePort (siehe port-research.ts), der bei jedem Laden einer
// Reise für die dortigen Häfen mitläuft - deckt nur Häfen ab, deren Reise
// tatsächlich geöffnet wird. Dieses Skript geht daher EINMALIG und
// sequenziell (mit Pause) über die komplette port_research-Tabelle,
// unabhängig davon, ob eine Reise die betroffenen Häfen gerade anfährt.
//
// Nutzt lookupSightImage() aus lib/wikimedia.ts (Wikipedia-Titelbild, sonst
// Commons-weite Fotosuche als Fallback) - dieselbe Funktion, die auch
// researchAndSavePort verwendet, damit beide Wege dieselbe Trefferquote
// haben.
//
// Aufruf:
//   node --env-file=.env.local scripts/backfill-sight-images.ts

import { createClient } from "@supabase/supabase-js";
import { googleSearchUrl, lookupSightImage } from "../src/lib/wikimedia.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

// Genug Abstand zwischen einzelnen Häfen, um Wikipedias/Commons' anonymes
// Rate-Limit nicht auszulösen - pro Sehenswürdigkeit können das bereits zwei
// Anfragen sein (Wikipedia + ggf. Commons-Fallback), daher zusätzlich zur
// eigenen internen Pause von lookupSightImage nochmal Abstand zwischen den
// Items selbst.
const DELAY_MS = 2000;

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

  const rowsWithGaps = (rows ?? []).filter(
    (r) => Array.isArray(r.items) && (r.items as SightItem[]).some((item) => !item.image_url)
  );

  const totalMissing = rowsWithGaps.reduce(
    (sum, r) => sum + (r.items as SightItem[]).filter((item) => !item.image_url).length,
    0
  );
  console.log(`Häfen mit fehlenden Bildern: ${rowsWithGaps.length}`);
  console.log(`Fehlende Bilder gesamt:      ${totalMissing}\n`);

  let done = 0;
  let filled = 0;
  let stillMissing = 0;
  const bySource: Record<string, number> = {};

  for (const row of rowsWithGaps) {
    const items = row.items as SightItem[];
    let changed = false;
    const updatedItems: SightItem[] = [];
    for (const item of items) {
      if (item.image_url) {
        updatedItems.push(item);
        continue;
      }
      const lookup = await lookupSightImage(item.name, row.port_name);
      done++;
      if (lookup.url) {
        filled++;
        changed = true;
        bySource[lookup.source ?? "?"] = (bySource[lookup.source ?? "?"] ?? 0) + 1;
        updatedItems.push({
          ...item,
          image_url: lookup.url,
          image_source: lookup.source,
          article_url: lookup.articleUrl ?? item.article_url ?? googleSearchUrl(`${item.name} ${row.port_name}`),
          attribution: lookup.attribution,
        });
      } else {
        stillMissing++;
        updatedItems.push({
          ...item,
          article_url: lookup.articleUrl ?? item.article_url ?? googleSearchUrl(`${item.name} ${row.port_name}`),
        });
      }
      await sleep(DELAY_MS);
    }

    if (changed) {
      const { error: updateError } = await supabase
        .from("port_research")
        .update({ items: updatedItems })
        .eq("id", row.id);
      if (updateError) {
        console.error(`  Update fehlgeschlagen (${row.port_name}):`, updateError.message);
        continue;
      }
    }

    const filledHere = updatedItems.filter((i, idx) => i.image_url && !items[idx].image_url).length;
    console.log(`${row.port_name.padEnd(30)} +${filledHere} Bild(er) (${done}/${totalMissing} geprüft)`);
  }

  console.log(`\nFertig: ${filled} Bilder ergänzt (${JSON.stringify(bySource)}), ${stillMissing} weiterhin ohne Treffer.`);
}

main().catch((err) => {
  console.error("Backfill fehlgeschlagen:", err);
  process.exit(1);
});
