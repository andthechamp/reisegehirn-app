// Weltreise-Häfen Extended: Agadir, Tanger, Gibraltar
// Externe Recherche mit vollständiger Abdeckung aller Kategorien.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-extended.ts

import { createClient } from "@supabase/supabase-js";
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
  note?: string;
}

const findings: RawFinding[] = [
  // Agadir (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Agadir",
    content: "1. Strand von Agadir – 8 km langer, halbmondförmiger Sandstrand direkt am Hafen\n2. Kasbah von Agadir Oufella – Ruinen einer historischen Festung mit Panoramablick\n3. Souk El Had – großer traditioneller Markt der Stadt\n4. Vallée des Oiseaux (Vogeltal) – kleiner Zoo/Park im Stadtzentrum\n5. Taghazout – bekanntes Surferdorf, ca. 20 km nördlich der Stadt",
    items: [
      { name: "Strand von Agadir", description: "8 km langer, halbmondförmiger Sandstrand direkt am Hafen" },
      { name: "Kasbah von Agadir Oufella", description: "Ruinen einer historischen Festung mit Panoramablick" },
      { name: "Souk El Had", description: "Großer traditioneller Markt der Stadt" },
      { name: "Vallée des Oiseaux", description: "Kleiner Zoo/Park im Stadtzentrum" },
      { name: "Taghazout", description: "Bekanntes Surferdorf, ca. 20 km nördlich der Stadt" },
    ],
    source_tier: "2",
    source_name: "whatsinport.com / meinschiff.com",
    source_url: "https://www.whatsinport.com/Agadir.htm",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Agadir",
    content: "Der Kreuzfahrtterminal liegt am nordwestlichen Ende des 8 km langen, sichelförmigen Hauptstrands von Agadir • Es gibt keine Einrichtungen direkt am Dock • Der zentrale Strandabschnitt ist per Taxi in ca. 10 Minuten oder zu Fuß in ca. 30-45 Minuten entlang der Küstenstraße erreichbar",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Agadir.htm",
    staleness: "zeitlos",
    confirmed_by: ["meinschiff.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Agadir",
    content: "Mein Schiff (TUI Cruises) läuft Agadir regelmäßig im Rahmen von Kanaren-mit-Marokko-Routen an (z. B. 7-nächtige Route ab/bis Santa Cruz de Tenerife), buchbar über meinschiff.com",
    source_tier: "1",
    source_name: "meinschiff.com",
    source_url: "https://www.meinschiff.com/de/haefen/agadir-marokko-2663",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Agadir",
    content: "Für den Souk El Had oder die Kasbah empfiehlt sich Taxi, da beide etwas weiter vom Hafen entfernt liegen • Der Strand direkt vor dem Terminal ist dagegen leicht zu Fuß oder per kurzer Taxifahrt erreichbar und eignet sich gut für einen entspannten Landgang",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Agadir.htm",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Agadir",
    content: "Der zentrale, beste Strandabschnitt ist entlang der Küstenstraße in ca. 30-45 Minuten zu Fuß erreichbar, alternativ Taxi in ca. 10 Minuten • Am Dock selbst gibt es keine Einrichtungen",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Agadir.htm",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Agadir",
    content: "Typisch marokkanisch sind Tajine (Schmorgericht in traditionellem Tontopf), Couscous und frischer Fisch, da Agadir ein bedeutender Fischereihafen ist • Entlang der Strandpromenade und im Souk El Had gibt es zahlreiche Restaurants und Streetfood-Stände",
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Agadir.htm",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Agadir",
    content: "Währung: Marokkanischer Dirham (MAD) • Sprache: Arabisch, Berbersprachen, Französisch weit verbreitet • Deutsche Staatsangehörige benötigen für Marokko kein Visum für touristische Aufenthalte bis 90 Tage • Notrufnummer: 19 (Polizei), 15 (Rettung)",
    source_tier: "3",
    source_name: "meinschiff.com",
    source_url: "https://www.meinschiff.com/de/haefen/agadir-marokko-2663",
    staleness: "zeitlos",
  },

  // Tanger (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Tanger",
    content: "1. Medina von Tanger – historische Altstadt mit engen Gassen und Souks\n2. Grand Socco – zentraler Platz als Eingangstor zur Medina\n3. Kasbah von Tanger – ehemalige Sultansresidenz mit Museum, hoch über der Stadt\n4. Cap Spartel & Herkuleshöhlen – Landspitze mit Leuchtturm und Meereshöhlen, ca. 14 km entfernt\n5. Petit Socco (Souk Dakhil) – kleiner, belebter Platz mitten in der Medina",
    items: [
      { name: "Medina von Tanger", description: "Historische Altstadt mit engen Gassen und Souks" },
      { name: "Grand Socco", description: "Zentraler Platz als Eingangstor zur Medina" },
      { name: "Kasbah von Tanger", description: "Ehemalige Sultansresidenz mit Museum, hoch über der Stadt" },
      { name: "Cap Spartel & Herkuleshöhlen", description: "Landspitze mit Leuchtturm und Meereshöhlen, ca. 14 km entfernt" },
      { name: "Petit Socco", description: "Kleiner, belebter Platz mitten in der Medina" },
    ],
    source_tier: "2",
    source_name: "cruisesheet.com / about2cruise.co.uk",
    source_url: "https://cruisesheet.com/port/tangier",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Tanger",
    content: "Kreuzfahrtschiffe legen am Port Tanger Ville (Tanger-Ville-Hafen) an, dem dedizierten Kreuzfahrt-/Fährterminal direkt im Stadtzentrum, NICHT zu verwechseln mit dem 40 km entfernten Frachthafen Tanger Med • Mein Schiff 6 legte laut cruisemapper.com am 11. August 2026 in Tanger an (Ankunft 07:00, Abfahrt 20:00 Uhr) • Der Terminal wurde speziell für Kreuzfahrt- und Fährverkehr modernisiert, nur 800 m bis 1,5 km vom Stadtzentrum entfernt",
    source_tier: "1",
    source_name: "cruisemapper.com / cruisesheet.com",
    source_url: "https://www.cruisemapper.com/ports/tangier-port-680",
    staleness: "zeitlos",
    confirmed_by: ["whatsinport.com", "about2cruise.co.uk"],
  },
  {
    category: "ausflug_offiziell",
    title: "Tanger",
    content: "Mein Schiff (TUI Cruises) läuft Tanger regelmäßig im Rahmen von Westmittelmeer-Marokko-Routen an (u. a. 8-tägige Route mit Leixões/Porto, Lissabon, Gibraltar, Cádiz, Tanger), buchbar über meinschiff.com • Landausflüge in die Medina und nach Cap Spartel werden angeboten",
    source_tier: "1",
    source_name: "meinschiff.com / kreuzfahrten-und-weltreisen.de",
    source_url: "https://www.meinschiff.com/de/haefen/tanger-marokko-2186",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Tanger",
    content: "about2cruise.co.uk empfiehlt, den Medina-Eingang am Grand Socco zu Fuß zu erkunden (ca. 20 Minuten Spaziergang entlang der Promenade) • WICHTIG: Bei manchen Kreuzfahrten wird ausnahmsweise der 40 km entfernte Tanger Med angelaufen statt Tanger Ville – dies kostet deutlich mehr Zeit für einen organisierten Transfer, daher vorab in der Reiseroute genau prüfen, welcher Hafen genutzt wird",
    source_tier: "3",
    source_name: "about2cruise.co.uk",
    source_url: "https://about2cruise.co.uk/tangier-cruise-ship-port-guide/",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Tanger",
    content: "Von Port Tanger Ville ist der Medina-Eingang am Grand Socco in ca. 20 Minuten (ca. 1,5 km) zu Fuß entlang der Uferpromenade erreichbar • Wird ausnahmsweise am 40 km entfernten Tanger Med angelegt, ist dies NICHT zu Fuß möglich, ein organisierter Transfer ist zwingend notwendig",
    source_tier: "2",
    source_name: "about2cruise.co.uk / cruisesheet.com",
    source_url: "https://about2cruise.co.uk/tangier-cruise-ship-port-guide/",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Tanger",
    content: "Typisch marokkanisch sind Tajine, Couscous und Pastilla (süß-herzhafte Teigtasche, oft mit Taube oder Hühnchen gefüllt) • In den Cafés der Medina und am Grand Socco lässt sich zudem die berühmte marokkanische Minztee-Kultur erleben, oft in traditionsreichen, jahrzehntealten Cafés",
    source_tier: "3",
    source_name: "cruisesheet.com",
    source_url: "https://cruisesheet.com/port/tangier",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Tanger",
    content: "Währung: Marokkanischer Dirham (MAD) • Sprache: Arabisch, Berbersprachen, Französisch und Spanisch weit verbreitet • Deutsche Staatsangehörige benötigen für Marokko kein Visum für touristische Aufenthalte bis 90 Tage • Notrufnummer: 19 (Polizei), 15 (Rettung) • Typischer Hafenaufenthalt beträgt laut about2cruise.co.uk 8-10 Stunden",
    source_tier: "3",
    source_name: "about2cruise.co.uk",
    source_url: "https://about2cruise.co.uk/tangier-cruise-ship-port-guide/",
    staleness: "zeitlos",
  },

  // Gibraltar (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Gibraltar",
    content: "1. Felsen von Gibraltar (Rock of Gibraltar) – markanter Kalksteinfelsen mit Seilbahn und Panoramablick\n2. Affenfelsen (Upper Rock Nature Reserve) – Heimat der berühmten Berberaffen\n3. St. Michael's Cave – beeindruckende Tropfsteinhöhle im Felsen\n4. Main Street – zentrale Einkaufsstraße mit Duty-Free-Shopping\n5. Gibraltar-Flughafenüberquerung – Straße kreuzt direkt die Landebahn des Flughafens",
    items: [
      { name: "Felsen von Gibraltar", description: "Markanter Kalksteinfelsen mit Seilbahn und Panoramablick" },
      { name: "Affenfelsen", description: "Upper Rock Nature Reserve, Heimat der berühmten Berberaffen" },
      { name: "St. Michael's Cave", description: "Beeindruckende Tropfsteinhöhle im Felsen" },
      { name: "Main Street", description: "Zentrale Einkaufsstraße mit Duty-Free-Shopping" },
      { name: "Flughafenüberquerung", description: "Straße kreuzt direkt die Landebahn des Flughafens" },
    ],
    source_tier: "3",
    source_name: "diycruiseports.com / whatsinport.com",
    source_url: "https://diycruiseports.com/diy-port-guides/gibraltar-cruise-port-diy-excursion-guide",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Gibraltar",
    content: "Kreuzfahrtschiffe legen am North Mole an, ca. 1,5 km vom Stadtzentrum entfernt (ca. 15 Minuten Fußweg) • Der Terminal verfügt über Telefone, Bar/Cafeteria, Kunsthandwerksläden und ein Tourismusbüro von Gibraltar • Bushaltestellen befinden sich auf dem Weg in die Stadt, manche Busse akzeptieren jedoch kein bargeldloses Bezahlen",
    source_tier: "2",
    source_name: "whatsinport.com / cruisecrocodile.com",
    source_url: "https://www.whatsinport.com/Gibraltar.htm",
    staleness: "zeitlos",
    confirmed_by: ["diycruiseports.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Gibraltar",
    content: 'Mein Schiff (TUI Cruises) läuft Gibraltar regelmäßig im Rahmen von Westmittelmeer- und Marokko-Routen an (u. a. 14-nächtige Route "Schönheiten des westlichen Mittelmeers" ab/bis Palma), buchbar über meinschiff.com',
    source_tier: "1",
    source_name: "meinschiff.com",
    source_url: "https://www.meinschiff.com/de/haefen/gibraltar-gibraltar-668",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Gibraltar",
    content: "Vom Terminal aus lässt sich die Main Street in ca. 15 Minuten zu Fuß erreichen • Ein Mini-Van-Tour-Anbieter direkt vor den Hafentoren bietet 90-minütige bis 2-stündige Touren zum Felsen und Affenfelsen an, alternativ die Seilbahn (Cable Car) vom Alameda Botanic Gardens aus",
    source_tier: "3",
    source_name: "diycruiseports.com",
    source_url: "https://diycruiseports.com/diy-port-guides/gibraltar-cruise-port-diy-excursion-guide",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Gibraltar",
    content: "Vom North Mole Terminal ist die Innenstadt mit der Main Street in ca. 15 Minuten (1,5 km) zu Fuß erreichbar • Für den Felsen und die Seilbahnstation ist ein weiterer Fußweg oder Taxi/Bus nötig, da diese am südlichen Ende der Stadt liegen",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Gibraltar.htm",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Gibraltar",
    content: "Gibraltar bietet eine ungewöhnliche Mischung aus britischer und spanisch-mediterraner Küche: Fish and Chips neben Tapas und Calentita (lokales Kichererbsenmehl-Gebäck) sind typisch • Entlang der Main Street gibt es zahlreiche Pubs und Cafés mit britischem Flair",
    source_tier: "3",
    source_name: "diycruiseports.com",
    source_url: "https://diycruiseports.com/diy-port-guides/gibraltar-cruise-port-diy-excursion-guide",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Gibraltar",
    content: "Währung: Gibraltar-Pfund (GIP, 1:1 an britischem Pfund gekoppelt), Euro wird oft ebenfalls akzeptiert • Sprache: Englisch (Amtssprache), Spanisch weit verbreitet • Gibraltar ist britisches Überseegebiet, deutsche Staatsangehörige benötigen kein Visum für touristische Aufenthalte • Notrufnummer: 199 (Polizei/Feuerwehr/Rettung), 112 funktioniert ebenfalls",
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Gibraltar.htm",
    staleness: "zeitlos",
  },
];

function canonicalPortName(rawTitle: string): string {
  return libCanonicalPortName(rawTitle);
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
