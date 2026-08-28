// Weltreise-Häfen Final: Yokohama, Osaka, Tokio, Port Louis, Victoria, Le Port
// Externe Recherche mit vollständiger Abdeckung aller Kategorien.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-final.ts

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
  // Yokohama (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Yokohama",
    content: "1. Minato Mirai 21 – moderne Skyline mit Landmark Tower und Riesenrad\n2. Yokohama Chinatown – größtes Chinatown-Viertel Japans\n3. Sankeien Garden – traditioneller japanischer Garten mit historischen Gebäuden\n4. Kamakura – historische Tempelstadt mit großem Buddha, ca. 1 Std. entfernt\n5. Hakone – Vulkanlandschaft mit Onsen und Blick auf den Fuji, ca. 1,5 Std. entfernt",
    items: [
      { name: "Minato Mirai 21", description: "Moderne Skyline mit Landmark Tower und Riesenrad" },
      { name: "Yokohama Chinatown", description: "Größtes Chinatown-Viertel Japans" },
      { name: "Sankeien Garden", description: "Traditioneller japanischer Garten mit historischen Gebäuden" },
      { name: "Kamakura", description: "Historische Tempelstadt mit großem Buddha, ca. 1 Std. entfernt" },
      { name: "Hakone", description: "Vulkanlandschaft mit Onsen und Blick auf den Fuji, ca. 1,5 Std. entfernt" },
    ],
    source_tier: "2",
    source_name: "japansophy.com / mlit.go.jp",
    source_url: "https://www.japansophy.com/post/japan-cruises-yokohama-port",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Yokohama",
    content: "Yokohama verfügt über drei Kreuzfahrtterminals: Osanbashi Pier (offiziell Yokohama International Passenger Terminal, direkt im Herzen der Stadt, ideal für individuelle Erkundung), Daikoku Pier (weiter außerhalb, für sehr große Schiffe, die nicht unter die Bay Bridge passen) und Shinko Pier • Der 5-stöckige Terminalbau am Osanbashi Pier beherbergt 25 Shops und ein Luxushotel (InterContinental Yokohama Pier8)",
    source_tier: "1",
    source_name: "mlit.go.jp / whatsinport.com",
    source_url: "https://www.mlit.go.jp/kankocho/cruise/detail/019/index.html",
    staleness: "zeitlos",
    confirmed_by: ["japansophy.com", "cruisemapper.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Yokohama",
    content: "Mein Schiff (TUI Cruises) nutzt Yokohama regelmäßig als Heimathafen für Japan- und Weltentdecker-Routen (u. a. Mein Schiff 6, 15-nächtige Japan-Reise sowie die 86-nächtige Große Weltentdecker-Route ab Yokohama/Tokio bis Palma), buchbar über meinschiff.com",
    source_tier: "1",
    source_name: "meinschiff.com / dreamlines.de",
    source_url: "https://www.meinschiff.com/de/haefen/osaka-japan-1484",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Yokohama",
    content: "japansophy.com empfiehlt für Tagesausflüge auf eigene Faust Kamakura (Zug ab Yokohama Station, ca. 1 Std.) oder Hakone (JR-Zug plus Umstieg, ca. 1,5 Std.) • Bei Anlegen am Osanbashi Pier ist die Erkundung von Minato Mirai und Chinatown komplett zu Fuß möglich, bei Daikoku Pier ist ein Shuttle oder Taxi zur Bahnstation notwendig",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruises-yokohama-port",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Yokohama",
    content: "Vom Osanbashi Pier sind Minato Mirai 21, Yokohama Chinatown und der Sankeien Garden alle in Gehdistanz (ca. 10-20 Minuten) erreichbar, der Terminal gilt als bester Ausgangspunkt für individuelle Erkundung • Vom weiter entfernten Daikoku Pier ist ein Shuttle notwendig, da sich dort kaum Infrastruktur in Gehdistanz befindet",
    source_tier: "2",
    source_name: "japansophy.com / whatsinport.com",
    source_url: "https://www.japansophy.com/post/japan-cruises-yokohama-port",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Yokohama",
    content: "Yokohama Chinatown bietet die größte Auswahl an chinesischer Küche in Japan, u. a. Dim Sum und Nikuman (gedämpfte Teigtaschen) • Ramen ist ebenfalls eine lokale Spezialität (Ie-kei-Ramen-Stil stammt aus Yokohama), zudem lohnt sich der Besuch des Shin-Yokohama Raumen Museums",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruises-yokohama-port",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Yokohama",
    content: "Währung: Japanischer Yen (JPY) • Sprache: Japanisch, Englisch in touristischen Gebieten begrenzt verbreitet • Deutsche Staatsangehörige benötigen für Japan kein Visum für touristische Aufenthalte bis 90 Tage • Notrufnummer: 110 (Polizei), 119 (Feuerwehr/Rettung)",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruise-ports-guide",
    staleness: "zeitlos",
  },

  // Osaka (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Osaka",
    content: "1. Osaka-Burg – historische Festung mit Museum, umgeben von einem Park mit Kirschblüten\n2. Dotonbori – lebhaftes Vergnügungsviertel mit Leuchtreklamen und Streetfood\n3. Umeda Sky Building – markanter Wolkenkratzer mit Aussichtsplattform\n4. Shinsaibashi – zentrale Einkaufsstraße\n5. Kyoto & Nara – klassische Kulturstädte, per Zug ca. 30-45 Min. entfernt",
    items: [
      { name: "Osaka-Burg", description: "Historische Festung mit Museum, umgeben von einem Kirschblütenpark" },
      { name: "Dotonbori", description: "Lebhaftes Vergnügungsviertel mit Leuchtreklamen und Streetfood" },
      { name: "Umeda Sky Building", description: "Markanter Wolkenkratzer mit Aussichtsplattform" },
      { name: "Shinsaibashi", description: "Zentrale Einkaufsstraße" },
      { name: "Kyoto & Nara", description: "Klassische Kulturstädte, per Zug ca. 30-45 Min. entfernt" },
    ],
    source_tier: "1",
    source_name: "meinschiff.com / mlit.go.jp",
    source_url: "https://www.meinschiff.com/de/haefen/osaka-japan-1484",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Osaka",
    content: "Schiffe legen am Tempozan Pier im Zentrum der sich stetig entwickelnden Osaka-Waterfront an, direkt neben einem großen Einkaufszentrum und dem beeindruckenden Riesenrad Tempozan Ferris Wheel • Kein Tenderbetrieb notwendig, der Terminal liegt zentral und ist gut angebunden",
    source_tier: "2",
    source_name: "whatsinport.com / mlit.go.jp",
    source_url: "https://www.whatsinport.com/Osaka.htm",
    staleness: "zeitlos",
    confirmed_by: ["japansophy.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Osaka",
    content: "Mein Schiff (TUI Cruises) läuft Osaka regelmäßig im Rahmen von Japan- und Weltentdecker-Routen an (u. a. Mein Schiff 6 auf der 86-nächtigen Großen Weltentdecker-Route), buchbar über meinschiff.com • Landausflüge nach Kyoto und Nara werden angeboten",
    source_tier: "1",
    source_name: "meinschiff.com",
    source_url: "https://www.meinschiff.com/de/haefen/osaka-japan-1484",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Osaka",
    content: "japansophy.com weist darauf hin, dass immer mehr Reiserouten in Osaka statt Yokohama beginnen bzw. enden, was Osaka zunehmend auch als Pre-/Post-Cruise-Basis attraktiv macht • Für Kyoto (ca. 30 Min. per Zug) oder Nara (ca. 45 Min.) empfiehlt sich der JR-Zug ab Osaka Station",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruise-ports-guide",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Osaka",
    content: "Vom Tempozan Pier ist das angrenzende Einkaufszentrum und das Riesenrad direkt zu Fuß erreichbar • Dotonbori und Shinsaibashi liegen weiter entfernt im Zentrum, hier ist die U-Bahn (Osaka Metro) die gängige Verbindung",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Osaka.htm",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Osaka",
    content: "Osaka gilt als Küche Japans (Kuidaore, iss dich arm): Takoyaki (frittierte Oktopusbällchen), Okonomiyaki (herzhafter Pfannkuchen) und Kushikatsu (frittierte Spieße) sind Streetfood-Klassiker, besonders im Viertel Dotonbori",
    source_tier: "3",
    source_name: "meinschiff.com",
    source_url: "https://www.meinschiff.com/de/haefen/osaka-japan-1484",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Osaka",
    content: "Währung: Japanischer Yen (JPY) • Sprache: Japanisch, Englisch begrenzt verbreitet • Deutsche Staatsangehörige benötigen für Japan kein Visum für touristische Aufenthalte bis 90 Tage • Notrufnummer: 110 (Polizei), 119 (Feuerwehr/Rettung)",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruise-ports-guide",
    staleness: "zeitlos",
  },

  // Tokio (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Tokio",
    content: "1. Senso-ji-Tempel in Asakusa – ältester buddhistischer Tempel Tokios\n2. Shibuya Crossing & Shibuya – belebteste Kreuzung der Welt mit Shopping und Unterhaltung\n3. Tokyo Skytree – einer der höchsten Fernsehtürme der Welt mit Aussichtsplattform\n4. Meiji-Jingu-Schrein – bedeutender Shinto-Schrein inmitten eines Waldes\n5. Tsukiji Outer Market – berühmter Fischmarkt mit Streetfood und Sushi",
    items: [
      { name: "Senso-ji-Tempel", description: "Ältester buddhistischer Tempel Tokios, im Stadtteil Asakusa" },
      { name: "Shibuya Crossing", description: "Belebteste Kreuzung der Welt mit Shopping und Unterhaltung" },
      { name: "Tokyo Skytree", description: "Einer der höchsten Fernsehtürme der Welt mit Aussichtsplattform" },
      { name: "Meiji-Jingu-Schrein", description: "Bedeutender Shinto-Schrein inmitten eines Waldes" },
      { name: "Tsukiji Outer Market", description: "Berühmter Fischmarkt mit Streetfood und Sushi" },
    ],
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Tokyo.htm",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Tokio",
    content: "Der Tokyo International Cruise Terminal (eröffnet 10. September 2020) liegt im Stadtteil Odaiba, in Reichweite wichtiger Verkehrsknotenpunkte inklusive Shinkansen-Bahnhöfe und zwei internationaler Flughäfen • Der Terminal wurde speziell gebaut, um auch den größten Kreuzfahrtschiffen der Welt Zugang zu Tokio zu ermöglichen • Viele Reedereien nutzen alternativ oder ergänzend Yokohama als Tokio-nahen Hafen",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Tokyo.htm",
    staleness: "zeitlos",
    confirmed_by: ["japansophy.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Tokio",
    content: "Mein Schiff (TUI Cruises) nutzt sowohl Tokio (Odaiba) als auch Yokohama als Ein-/Ausstiegshäfen für Japan-Kreuzfahrten, je nach Route (z. B. Faszination Asien ab Tokio bis Singapur), buchbar über meinschiff.com bzw. Reisebüropartner",
    source_tier: "2",
    source_name: "kreuzfahrten-reisebuero.de",
    source_url: "https://www.kreuzfahrten-reisebuero.de/mein-schiff-6-28-naechte-faszination-asien-ab-tokio-bis-singapur",
    staleness: "saisonal",
    tier_note: "Route über Reisebüropartner-Portal bestätigt, keine direkte meinschiff.com-Tokio-Hafenseite separat verifiziert.",
  },
  {
    category: "ausflug_privat",
    title: "Tokio",
    content: "Vom Terminal in Odaiba aus ist die Innenstadt (Shibuya, Asakusa) per Yurikamome-Bahn oder Rinkai-Linie in ca. 20-30 Minuten erreichbar • Odaiba selbst bietet bereits Einkaufszentren, den Odaiba-Strand und das teamLab-Museum als nahegelegene Ziele",
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Tokyo.htm",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Tokio",
    content: "Vom Tokyo International Cruise Terminal in Odaiba sind einige Einkaufszentren und der Odaiba-Strand zu Fuß erreichbar • Die klassischen Hauptattraktionen (Shibuya, Asakusa, Shinjuku) liegen jedoch weiter im Stadtzentrum und sind NICHT zu Fuß erreichbar, U-Bahn oder Bahn wird benötigt",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Tokyo.htm",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Tokio",
    content: "Sushi, Ramen und Tempura sind die international bekanntesten Klassiker, aber auch Monjayaki (ähnlich Okonomiyaki) ist eine Tokio-Spezialität, v. a. im Viertel Tsukishima • Der Tsukiji Outer Market bietet frischen Fisch und Streetfood direkt zum Verzehr",
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Tokyo.htm",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Tokio",
    content: "Währung: Japanischer Yen (JPY) • Sprache: Japanisch, Englisch begrenzt verbreitet, aber zunehmend touristenfreundliche Beschilderung • Deutsche Staatsangehörige benötigen für Japan kein Visum für touristische Aufenthalte bis 90 Tage • Notrufnummer: 110 (Polizei), 119 (Feuerwehr/Rettung)",
    source_tier: "3",
    source_name: "japansophy.com",
    source_url: "https://www.japansophy.com/post/japan-cruise-ports-guide",
    staleness: "zeitlos",
  },

  // Port Louis (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Port Louis (Mauritius)",
    content: "1. Caudan Waterfront – moderne Einkaufs- und Freizeitpromenade direkt am Hafen\n2. Zentralmarkt Port Louis – lebhafter Markt mit Gewürzen und lokalem Kunsthandwerk\n3. Aapravasi Ghat (UNESCO-Weltkulturerbe) – historische Einwanderungsstätte\n4. Champ de Mars – älteste Pferderennbahn der südlichen Hemisphäre\n5. Le Morne Brabant – markanter Berg und UNESCO-Weltkulturerbe, ca. 45 km entfernt",
    items: [
      { name: "Caudan Waterfront", description: "Moderne Einkaufs- und Freizeitpromenade direkt am Hafen" },
      { name: "Zentralmarkt Port Louis", description: "Lebhafter Markt mit Gewürzen und lokalem Kunsthandwerk" },
      { name: "Aapravasi Ghat", description: "UNESCO-Weltkulturerbe, historische Einwanderungsstätte" },
      { name: "Champ de Mars", description: "Älteste Pferderennbahn der südlichen Hemisphäre" },
      { name: "Le Morne Brabant", description: "Markanter Berg und UNESCO-Weltkulturerbe, ca. 45 km entfernt" },
    ],
    source_tier: "3",
    source_name: "escapetheroomers.com / cruisesheet.com",
    source_url: "https://www.escapetheroomers.com/post/one-day-guide-in-port-louis-mauritius-cruise-edition",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Port Louis (Mauritius)",
    content: "Schiffe legen am modernen Christian Decotter Cruise Terminal an, der auch die größten Schiffe der Welt aufnehmen kann und Ende 2023 offiziell mit einer Kapazität von 4.000 Passagieren täglich eröffnet wurde • Der Terminal liegt ca. 2-3 km (1,5 Meilen) vom Caudan Waterfront und Stadtzentrum entfernt • Kein Tenderbetrieb notwendig",
    source_tier: "2",
    source_name: "cruisesheet.com / cruisemapper.com",
    source_url: "https://cruisesheet.com/port/mauritius",
    staleness: "zeitlos",
    confirmed_by: ["whatsinport.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Port Louis (Mauritius)",
    content: "Mein Schiff (TUI Cruises) nutzt Port Louis regelmäßig, u. a. auf 14-tägigen Routen zwischen Kapstadt und Mauritius sowie der 25-nächtigen Route Indischer Ozean mit Mauritius (ab Kapstadt bis Singapur) mit Ankunft/Abfahrt am 24. November 2026 laut cruisemapper.com, buchbar über meinschiff.com",
    source_tier: "1",
    source_name: "meinschiff.com / cruisemapper.com",
    source_url: "https://www.meinschiff.com/de/logbuch",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Port Louis (Mauritius)",
    content: "Ein Bericht auf escapetheroomers.com beschreibt Port Louis primär als Handelshafen mit begrenztem touristischem Angebot direkt in der Stadt • Für Le Morne Brabant (ca. 45 km) oder die berühmten Strände der Insel wird Taxi, Mietwagen oder organisierte Tour empfohlen, da diese außerhalb der Stadt liegen",
    source_tier: "3",
    source_name: "escapetheroomers.com",
    source_url: "https://www.escapetheroomers.com/post/one-day-guide-in-port-louis-mauritius-cruise-edition",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Port Louis (Mauritius)",
    content: "Vom Christian Decotter Cruise Terminal ist die Caudan Waterfront in ca. 2-3 km bzw. wenigen Taxi-Minuten erreichbar, ein Fußweg ist möglich, aber je nach Hitze und Gepäck weniger komfortabel • Innerhalb der Waterfront selbst sind Shops und Restaurants direkt zu Fuß erreichbar",
    source_tier: "2",
    source_name: "cruisesheet.com",
    source_url: "https://cruisesheet.com/port/mauritius",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Port Louis (Mauritius)",
    content: "Die mauritische Küche vereint indische, chinesische, kreolische und französische Einflüsse: Dholl Puri (gefülltes Fladenbrot), Rougaille (Tomaten-Kreolensauce mit Fisch oder Fleisch) und frische tropische Früchte sind typisch • Der Zentralmarkt bietet vielfältiges Streetfood und Gewürze",
    source_tier: "3",
    source_name: "cruisesheet.com",
    source_url: "https://cruisesheet.com/port/mauritius",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Port Louis (Mauritius)",
    content: "Währung: Mauritius-Rupie (MUR) • Sprache: Englisch und Französisch (Amtssprachen), Mauritius-Kreol als Umgangssprache • Deutsche Staatsangehörige benötigen für Mauritius kein Visum für touristische Aufenthalte bis 60 Tage • Notrufnummer: 999 (Polizei), 114 (Feuerwehr/Rettung) • Beste Reisezeit für Kreuzfahrten ist laut escapetheroomers.com Oktober bis Dezember",
    source_tier: "3",
    source_name: "escapetheroomers.com",
    source_url: "https://www.escapetheroomers.com/post/one-day-guide-in-port-louis-mauritius-cruise-edition",
    staleness: "verfällt",
    tier_note: "Visumfreie Aufenthaltsdauer kann sich ändern, vor Reise stets aktuellen Stand prüfen.",
  },

  // Victoria (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Victoria (Seychellen)",
    content: "1. Clock Tower (Lorloz) – kleiner Nachbau des Londoner Big Ben, Wahrzeichen von Victoria\n2. Sir Selwyn Selwyn-Clarke Market – lebhafter Markt mit Gewürzen, Fisch und Kunsthandwerk\n3. Botanischer Garten Victoria – mit Riesenschildkröten und Fledermäusen\n4. Hindu-Tempel Arul Mihu Navasakthi Vinayagar – bunt verzierter Tempel im Zentrum\n5. Strände von Mahé (Beau Vallon, Anse Royale) – einige der schönsten Strände der Seychellen",
    items: [
      { name: "Clock Tower (Lorloz)", description: "Kleiner Nachbau des Londoner Big Ben, Wahrzeichen von Victoria" },
      { name: "Sir Selwyn Selwyn-Clarke Market", description: "Lebhafter Markt mit Gewürzen, Fisch und Kunsthandwerk" },
      { name: "Botanischer Garten Victoria", description: "Mit Riesenschildkröten und Fledermäusen" },
      { name: "Hindu-Tempel", description: "Bunt verzierter Arul Mihu Navasakthi Vinayagar Tempel im Zentrum" },
      { name: "Strände von Mahé", description: "Beau Vallon und Anse Royale, einige der schönsten Strände der Seychellen" },
    ],
    source_tier: "3",
    source_name: "bucketlistguides.com / whatsinport.com",
    source_url: "https://bucketlistguides.com/victoria-mahe-cruise-port-guide/",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Victoria (Seychellen)",
    content: "Victoria auf der Insel Mahé ist ein reiner Liegeplatzhafen (KEIN Tenderhafen) – Schiffe legen direkt am kommerziellen Pier von Port Victoria an, Passagiere gehen direkt vom Gangway in die Stadt • Der Fußweg führt vorbei an den Hafenbehörden-Büros durch einen überdachten Gang zur Straße, danach rechts Richtung Innenstadt",
    source_tier: "2",
    source_name: "whatsinport.com / bucketlistguides.com",
    source_url: "https://www.whatsinport.com/Victoria-Mahe.htm",
    staleness: "zeitlos",
    confirmed_by: ["cruisekingdom.co.uk"],
  },
  {
    category: "ausflug_offiziell",
    title: "Victoria (Seychellen)",
    content: "Mein Schiff (TUI Cruises) läuft Victoria/Mahé im Rahmen von Weltreise- und Indischer-Ozean-Routen an, Landausflüge zu den Stränden Beau Vallon und Anse Royale sowie Inselrundfahrten werden über meinschiff.com angeboten",
    source_tier: "3",
    source_name: "meine-kreuzfahrtlounge.de",
    source_url: "https://www.meine-kreuzfahrtlounge.de/angebote/meinschiff/mein-schiff-6-indischer-ozean-mit-mauritius/",
    staleness: "saisonal",
    tier_note: "Keine direkte meinschiff.com-Hafenseite für Victoria/Seychellen separat verifiziert, Route über Reisebüropartner-Portal plausibilisiert.",
  },
  {
    category: "ausflug_privat",
    title: "Victoria (Seychellen)",
    content: "WICHTIG (Stand 2026): Seit Januar 2026 müssen alle Passagiere vorab die Seychelles Travel Authorization online über das offizielle Regierungsportal ausfüllen, verbunden mit einer Gebühr von 12,06 Euro pro Person • bucketlistguides.com empfiehlt, den lokalen Bus für die kurze Strecke zu den Stränden zu meiden zugunsten eines Taxis, da die Busverbindungen umständlich sein können",
    source_tier: "1",
    source_name: "bucketlistguides.com",
    source_url: "https://bucketlistguides.com/victoria-mahe-cruise-port-guide/",
    staleness: "verfällt",
    tier_note: "Gebühr und Registrierungspflicht Stand Anfang 2026, vor Reise stets aktuellen Stand auf dem offiziellen Regierungsportal prüfen.",
  },
  {
    category: "zu_fuss",
    title: "Victoria (Seychellen)",
    content: "Victoria gilt laut bucketlistguides.com als echter Anlegehafen (True Docking Port) – man geht direkt von der Gangway in die Stadt, der Clock Tower und die Innenstadt sind in ca. 5-10 Minuten zu Fuß erreichbar, deutlich einfacher als in vielen anderen Häfen der Region",
    source_tier: "2",
    source_name: "bucketlistguides.com / whatsinport.com",
    source_url: "https://bucketlistguides.com/victoria-mahe-cruise-port-guide/",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Victoria (Seychellen)",
    content: "Kreolische Küche der Seychellen kombiniert französische, afrikanische und asiatische Einflüsse: gegrillter Fisch mit Ladob (Kokosmilch-Bananen-Sauce) sowie Curry mit Fledermausfleisch (Chauve-souris) gelten als traditionelle Spezialitäten • Auf dem Sir Selwyn Selwyn-Clarke Market gibt es frische tropische Früchte und Gewürze",
    source_tier: "3",
    source_name: "bucketlistguides.com",
    source_url: "https://bucketlistguides.com/victoria-mahe-cruise-port-guide/",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Victoria (Seychellen)",
    content: "Währung: Seychellen-Rupie (SCR) • Sprache: Kreolisch (Amtssprache), Englisch und Französisch weit verbreitet • Deutsche Staatsangehörige benötigen kein klassisches Visum, MÜSSEN aber seit Januar 2026 vorab die Seychelles Travel Authorization online beantragen (Gebühr 12,06 Euro/Person, Stand 2026) • Notrufnummer: 999 (Polizei), 151 (Feuerwehr/Rettung)",
    source_tier: "1",
    source_name: "bucketlistguides.com",
    source_url: "https://bucketlistguides.com/victoria-mahe-cruise-port-guide/",
    staleness: "verfällt",
    tier_note: "Neue Einreisebestimmung (Travel Authorization) Stand Anfang 2026 – vor jeder Reise unbedingt aktuellen Stand auf dem offiziellen Regierungsportal prüfen, da sich Gebühren und Verfahren ändern können.",
  },

  // Le Port (7 Einträge)
  {
    category: "sehenswuerdigkeiten",
    title: "Le Port (Réunion)",
    content: "1. Saint-Denis – Hauptstadt von La Réunion mit kolonialer Architektur, ca. 8 Meilen/30 Min. entfernt\n2. Piton de la Fournaise – aktiver Vulkan im Inselinneren, weiter entfernter Tagesausflug\n3. Cirque de Mafate – spektakuläres Talkessel-Gebiet, nur zu Fuß oder per Helikopter erreichbar\n4. Saint-Paul – historische erste Kolonialsiedlung der Insel mit Markt\n5. Strände von Boucan Canot und Saint-Gilles – bekannte Badestrände nahe Saint-Paul",
    items: [
      { name: "Saint-Denis", description: "Hauptstadt von La Réunion mit kolonialer Architektur, ca. 30 Min. entfernt" },
      { name: "Piton de la Fournaise", description: "Aktiver Vulkan im Inselinneren, weiter entfernter Tagesausflug" },
      { name: "Cirque de Mafate", description: "Spektakuläres Talkessel-Gebiet, nur zu Fuß oder per Helikopter erreichbar" },
      { name: "Saint-Paul", description: "Historische erste Kolonialsiedlung der Insel mit Markt" },
      { name: "Boucan Canot & Saint-Gilles", description: "Bekannte Badestrände nahe Saint-Paul" },
    ],
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Le-Port.htm",
    staleness: "zeitlos",
  },
  {
    category: "anleger",
    title: "Le Port (Réunion)",
    content: "Kreuzfahrtschiffe legen am Hafen Pointe des Galets (allgemein Le Port genannt) an der Nordwestküste der Insel an, einem funktionalen Industriehafen mit endlosen Containerreihen • Die Entfernung zur Inselhauptstadt Saint-Denis beträgt ca. 8 Meilen (13 km), eine Fahrt von ca. 30 Minuten • Kein Tenderbetrieb notwendig, Schiffe legen direkt am Kai an",
    source_tier: "2",
    source_name: "whatsinport.com / cruisekingdom.co.uk",
    source_url: "https://www.whatsinport.com/Le-Port.htm",
    staleness: "zeitlos",
    confirmed_by: ["boards.cruisecritic.com"],
  },
  {
    category: "ausflug_offiziell",
    title: "Le Port (Réunion)",
    content: "Mein Schiff (TUI Cruises) läuft Le Port im Rahmen der Route Indischer Ozean mit Mauritius (ab Kapstadt bis Singapur) an, direkt nach Port Louis auf Mauritius • Landausflüge zum Piton de la Fournaise und nach Saint-Denis werden über meinschiff.com angeboten",
    source_tier: "1",
    source_name: "meine-kreuzfahrtlounge.de",
    source_url: "https://www.meine-kreuzfahrtlounge.de/angebote/meinschiff/mein-schiff-6-indischer-ozean-mit-mauritius/",
    staleness: "saisonal",
  },
  {
    category: "ausflug_privat",
    title: "Le Port (Réunion)",
    content: "Ein Cruise-Critic-Nutzer berichtet, dass ein einminütiger Shuttle vom Schiff zum Ort führt, an dem private Ausflugsanbieter die Gäste abholen • Für Saint-Denis (ca. 30 Min.) oder weiter entfernte Ziele wie den Vulkan Piton de la Fournaise empfiehlt sich Taxi, Mietwagen oder organisierte Tour, da öffentlicher Nahverkehr ab dem Hafen selbst begrenzt ist",
    source_tier: "3",
    source_name: "boards.cruisecritic.com",
    source_url: "https://boards.cruisecritic.com/topic/2703878-has-anyone-been-to-le-port-reunion/",
    staleness: "zeitlos",
  },
  {
    category: "zu_fuss",
    title: "Le Port (Réunion)",
    content: "Le Port selbst ist laut whatsinport.com aber trotz des Industriecharakters eine angenehme kleine Stadt mit einigem zu Fuß erreichbarem Angebot direkt beim Hafen • Saint-Denis (ca. 13 km) ist NICHT zu Fuß erreichbar, hier ist ein Transfer notwendig",
    source_tier: "2",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Le-Port.htm",
    staleness: "zeitlos",
  },
  {
    category: "essen",
    title: "Le Port (Réunion)",
    content: "Als französisches Überseedepartement bietet La Réunion eine Mischung aus kreolischer und französischer Küche: Cari (kreolisches Curry, meist mit Huhn oder Fisch), Rougail Saucisse (Wurst in Tomatensauce) und Samosas sind typisch • In Saint-Denis und Saint-Paul gibt es eine gute Auswahl an Restaurants und Märkten",
    source_tier: "3",
    source_name: "whatsinport.com",
    source_url: "https://www.whatsinport.com/Le-Port.htm",
    staleness: "zeitlos",
  },
  {
    category: "praktisches",
    title: "Le Port (Réunion)",
    content: "Währung: Euro (EUR), da La Réunion französisches Überseedepartement ist • Sprache: Französisch, kreolisch als Umgangssprache • Als Teil Frankreichs gehört La Réunion zur EU, ist aber NICHT im Schengen-Grenzkontrollraum, für EU-Bürger reicht dennoch der Personalausweis • Notrufnummer: 112/15/17/18",
    source_tier: "3",
    source_name: "meiers-weltreisen.de",
    source_url: "https://www.meiers-weltreisen.de/reiseziele/karibik/visum",
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
