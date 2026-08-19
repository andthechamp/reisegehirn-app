// Einmaliges Seed-Skript für das Faktendossier zur TUI-Cruises-Flotte
// "Mein Schiff 1-7" (allgemeine Schiffsdaten, Restaurants, Bars, Deckplan,
// Spa/Fitness/Pool, Bordprogramm), NICHT Teil der laufenden App.
// Füllt ship_research (category "schiffswissen") - analog zu
// scripts/seed-curated-tips.ts, aber als eigenständiges Skript, da eine
// eigene, in sich geschlossene Quelle (Recherche-Dossier vom 2026-08-19).
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-fleet-dossier.ts
//
// staleness bewusst durchgängig "zeitlos" (90 Tage TTL, siehe
// CACHE_TTL_DAYS_BY_STALENESS in src/lib/research-schema.ts): ein kürzerer
// Wert würde dazu führen, dass ensureShipResearched() den Cache vorzeitig für
// abgelaufen hält und researchAndSaveShip() die hier eingefügten Zeilen
// (cabin_category IS NULL) beim nächsten automatischen Refresh kommentarlos
// überschreibt.
//
// Löscht vor dem Einfügen jeweils bestehende Zeilen mit demselben
// (ship_name, category, title), damit das Skript wiederholt ausführbar ist,
// ohne Duplikate anzuhäufen.

import { createClient } from "@supabase/supabase-js";
import { splitSentences } from "../src/lib/format-list";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

const SOURCE_NAME = "Faktendossier TUI Cruises Mein Schiff Flotte (Recherche 2026-08-19)";

interface ShipTip {
  ship_name: string;
  title: string;
  content: string;
  sort_order: number;
}

interface RestaurantEntry {
  name: string;
  concept: string;
  extra?: string;
}

interface ShipDossier {
  ship_name: string;
  baujahr: string;
  indienststellung: string;
  werft: string;
  brz: string;
  laenge: string;
  breite: string;
  tiefgang: string;
  geschwindigkeit: string;
  paxDoppel: string;
  paxMax: string;
  kabinen: string;
  decks: string;
  crew: string;
  flagge: string;
  besonderheit?: string;
  inklusive: RestaurantEntry[];
  aufpreis: RestaurantEntry[];
  bars: string[];
  deckplan: string;
  spa: string;
  bordprogramm: string;
}

// "•"-getrennte Fakten statt eines Fließtext-Absatzes - FindingContent.tsx
// (siehe splitBulletList in src/lib/format-list.ts) erkennt das Muster und
// rendert automatisch eine <ul>-Liste statt eines dichten Textblocks.
function bullets(items: string[]): string {
  return items.map((i) => `• ${i}`).join(" ");
}

// Für bereits als Fließtext verfasste Abschnitte (Deckplan/Spa/Bordprogramm):
// per Satzgrenzen-Erkennung (siehe splitSentences, kennt deutsche Abkürzungen
// wie "ca.") in einzelne Sätze zerlegen und als Bullet-Liste ausgeben, statt
// den ganzen Absatz manuell neu zu formulieren.
function bulletsFromProse(text: string): string {
  const sentences = splitSentences(text) ?? [text];
  return bullets(sentences);
}

function generalDataContent(d: ShipDossier): string {
  const facts = [
    `Indienststellung: ${d.indienststellung}, gebaut bei ${d.werft}`,
    `Bruttoraumzahl: ${d.brz} BRZ`,
    `Länge/Breite/Tiefgang: ${d.laenge} / ${d.breite} / ${d.tiefgang}`,
    `Geschwindigkeit: ${d.geschwindigkeit}`,
    `Gäste bei Doppelbelegung: ${d.paxDoppel}`,
    `Gäste maximal: ${d.paxMax}`,
    `Kabinen: ${d.kabinen}`,
    `Decks: ${d.decks}`,
    `Crew: ca. ${d.crew}`,
    `Flagge/Heimathafen: ${d.flagge}`,
  ];
  if (d.besonderheit) facts.push(`Besonderheit: ${d.besonderheit}`);
  return bullets(facts);
}

// "Name – Konzept" (Gedankenstrich statt Bindestrich): FindingContent.tsx
// hebt den Namen vor dem "–" fett hervor (siehe BulletItem dort). Das
// "(inklusive)"/"(Aufpreis)"-Suffix pro Zeile entfällt bewusst - stattdessen
// zwei getrennte Karten (siehe toShipTips), das macht jede einzelne Liste
// kürzer und die Zugehörigkeit ergibt sich schon aus dem Kartentitel.
function restaurantList(entries: RestaurantEntry[]): string {
  return bullets(entries.map((r) => `${r.name} – ${r.concept}`));
}

function barsContent(d: ShipDossier): string {
  return bullets(d.bars);
}

function toShipTips(d: ShipDossier): ShipTip[] {
  return [
    { ship_name: d.ship_name, title: "Allgemeine Schiffsdaten", content: generalDataContent(d), sort_order: 0 },
    { ship_name: d.ship_name, title: "Restaurants an Bord (inklusive)", content: restaurantList(d.inklusive), sort_order: 1 },
    { ship_name: d.ship_name, title: "Spezialitätenrestaurants (Aufpreis)", content: restaurantList(d.aufpreis), sort_order: 2 },
    { ship_name: d.ship_name, title: "Bars und Lounges an Bord", content: barsContent(d), sort_order: 3 },
    { ship_name: d.ship_name, title: "Deckplan (Kurzüberblick)", content: bulletsFromProse(d.deckplan), sort_order: 4 },
    { ship_name: d.ship_name, title: "Spa, Fitness und Pool", content: bulletsFromProse(d.spa), sort_order: 5 },
    { ship_name: d.ship_name, title: "Bordprogramm und Abendgestaltung", content: bulletsFromProse(d.bordprogramm), sort_order: 6 },
  ];
}

const ships: ShipDossier[] = [
  {
    ship_name: "Mein Schiff 1",
    baujahr: "2018",
    indienststellung: "27. April 2018 (Ablieferung 25.4.2018, Taufe 11.5.2018 Hamburg)",
    werft: "Meyer Turku, Finnland",
    brz: "111.554",
    laenge: "315,7 m",
    breite: "35,8 m",
    tiefgang: "ca. 8 m",
    geschwindigkeit: "ca. 21-21,5 kn",
    paxDoppel: "2.894",
    paxMax: "ca. 2.894-3.100, ungesichert",
    kabinen: "1.447 (über 80 % mit Balkon)",
    decks: "16 (davon 14-15 für Gäste)",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit: "Erweiterter SPA-/Sportbereich, größer als bei Mein Schiff 3-6 (gleiche Baureihe wie Mein Schiff 2 und 7).",
    inklusive: [
      { name: "Atlantik - Klassik", concept: "Hauptrestaurant, Service am Platz (Deck 3)" },
      { name: "Atlantik - Mediterran", concept: "Hauptrestaurant mediterran (Deck 4)" },
      { name: "Anckelmannsplatz", concept: "Buffetrestaurant (Deck 12)" },
      { name: "Fischmarkt", concept: "Fisch & Meeresfrüchte" },
      { name: "Ganz Schön Gesund - Bistro", concept: "gesunde Küche (Deck 5)" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks fast rund um die Uhr (Deck 5)" },
      { name: "Backstube", concept: "Backwaren (Deck 12)" },
      { name: "Bosporus - Snackbar", concept: "herzhafte Snacks (Deck 12)" },
      { name: "Eis Bar", concept: "Eisspezialitäten (Deck 12)" },
    ],
    aufpreis: [
      { name: "Esszimmer - Lieblingsgerichte", concept: "deutsche Klassiker (Deck 4)" },
      { name: "Manufaktur / Cucimare - Ristorante", concept: "Kreativküche & italienisch (Deck 5)" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill (Deck 5)" },
    ],
    bars: [
      "Diamant Bar (rund um die Uhr, Aufpreis)",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Galerie Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Ebbe & Flut - Bier Bar (Craft-Beer, Kooperation Ratsherrn)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar (Diskothek)",
      "Casino & Lounge",
      "Hoheluft Bar",
      "Saftwerft (Aufpreis)",
      "X-Bar / X-Lounge (exklusiv für Suiten & Junior Suiten)",
    ],
    deckplan:
      "16 Decks. Deck 3: Rezeption, Atlantik Klassik, unterste Theaterebene, Bordhospital. Deck 4: Atlantik Mediterran, Esszimmer, TUI Bar, Galerie, Theater. Deck 5: Ganz Schön Gesund, Manufaktur, Surf & Turf, Tag & Nacht, Casino, Abtanz Bar, Schaubühne. Deck 6-10 überwiegend Kabinen. Deck 11: Kabinen, SPA-Balkonkabinen. Deck 12: Pooldeck, Anckelmannsplatz, Buffet, SPA & Meer, Fitness. Deck 14/15: Arena, Kids-Bereiche, Sonnendecks, X-Lounge.",
    spa: "SPA & Meer mit 25-Meter-Außenpool (Deck 12) und Innenpool/Lagune, mehreren Whirlpools. Finnische Sauna mit Panoramafenster, Kräuterdampfbad, Eisbrunnen, Bio-/Lichtsauna, Ruhebereiche, Tee Lounge. Großes Fitnessstudio 'Sport & Gesundheit' mit Kursangebot und Personal Training (Aufpreis). Außen: überdachte Arena (auch als Kino nutzbar), ca. 280 m Joggingstrecke.",
    bordprogramm:
      "Theater im Bug, dreistöckig, 1.000 Sitzplätze, drehbare Bühne, acht dynamische LED-Bildschirme. Zweite Bühne Schaubühne (bis 150 Plätze) hatte hier Premiere: Comedy, Zauberei, Boulevardtheater, Lesungen. Kids-Club 'Insel der Seeräuber' (Krabben 3-5, Seeteufel 6-8, Piranhas 9-11, in Ferien zusätzlich Mantas & Teens), Nest Baby-Raum. Show-Ensemble, Live-Musik, DJ, Pooldeck-Partys, Casino, kostenpflichtige Workshops/Verkostungen.",
  },
  {
    ship_name: "Mein Schiff 2",
    baujahr: "2019",
    indienststellung: "Februar 2019 (Taufe 9.2.2019 Lissabon, Patin Carolin Niemczyk)",
    werft: "Meyer Turku, Finnland",
    brz: "111.554",
    laenge: "315,7 m",
    breite: "35,8 m",
    tiefgang: "ca. 8 m",
    geschwindigkeit: "ca. 21-22 kn",
    paxDoppel: "2.894",
    paxMax: "ca. 2.894-3.132, ungesichert",
    kabinen: "1.447 (über 80 % mit Balkon)",
    decks: "16",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit: "Baugleich mit Mein Schiff 1 und 7 (größere Baureihe), erweiterter SPA-/Sportbereich.",
    inklusive: [
      { name: "Atlantik - Klassik", concept: "Hauptrestaurant" },
      { name: "Atlantik - Mediterran", concept: "Hauptrestaurant mediterran" },
      { name: "Anckelmannsplatz", concept: "Buffet" },
      { name: "Fischmarkt", concept: "Fisch/Meeresfrüchte" },
      { name: "Ganz Schön Gesund - Bistro", concept: "gesunde Küche" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks fast rund um die Uhr" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "herzhafte Snacks" },
      { name: "Eis Bar", concept: "Eis" },
    ],
    aufpreis: [
      { name: "Esszimmer - Lieblingsgerichte", concept: "deutsche Klassiker" },
      { name: "Manufaktur / Cucimare - Ristorante", concept: "Kreativküche/italienisch" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill" },
    ],
    bars: [
      "Diamant Bar (Aufpreis)",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Galerie Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Ebbe & Flut - Bier Bar (Ratsherrn)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar",
      "Casino & Lounge",
      "Hoheluft Bar",
      "Saftwerft (Aufpreis)",
      "X-Bar / X-Lounge (exklusiv für Suiten)",
    ],
    deckplan:
      "16 Decks, Aufbau wie Mein Schiff 1: Restaurants/Theater/Rezeption Deck 3-5, Kabinen Deck 6-11, Pool/Spa Deck 12, Sport/Kids Deck 14/15.",
    spa: "SPA & Meer, identisch zu Mein Schiff 1: 25-m-Außenpool + zweiter Pool/Innenpool, große Saunalandschaft, großes Fitnessstudio, Arena, ca. 280 m Joggingstrecke.",
    bordprogramm:
      "Theater im Bug, dreistöckig, 1.000 Sitzplätze. Schaubühne (ca. 150 Plätze). Sturmfrei-Teenslounge. Kids-Club 'Insel der Seeräuber'. Casino. Show-Ensemble (ca. 50 Künstler), DJ, Krimi-Dinner, Kochshows.",
  },
  {
    ship_name: "Mein Schiff 3",
    baujahr: "2014",
    indienststellung: "Juni 2014 (Ablieferung 22.5.2014, Taufe 12.6.2014 Hamburg, Patin Helene Fischer)",
    werft: "STX Finland Oy, Turku (heute Meyer Turku)",
    brz: "99.526",
    laenge: "293,3 m",
    breite: "35,8 m",
    tiefgang: "8,05 m",
    geschwindigkeit: "ca. 21,7 kn",
    paxDoppel: "2.506",
    paxMax: "ca. 2.700, ungesichert",
    kabinen: "1.253 (über 80 % mit Balkon)",
    decks: "15 (davon 12 für Gäste)",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit:
      "Kleinere Baureihe zusammen mit Mein Schiff 4-6. Erstes TUI-Cruises-Schiff mit 25-Meter-Außenpool.",
    inklusive: [
      { name: "Atlantik - Klassik", concept: "Hauptrestaurant (Deck 3)" },
      { name: "Atlantik - Mediterran", concept: "Hauptrestaurant mediterran (Deck 4)" },
      { name: "Anckelmannsplatz", concept: "Buffet (Deck 11/12)" },
      { name: "GOSCH Sylt", concept: "Fischrestaurant" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "herzhafte Snacks" },
      { name: "Eis Bar", concept: "Eis" },
    ],
    aufpreis: [
      { name: "Hanami - by Tim Raue", concept: "japanisch/asiatisch (Deck 5)" },
      { name: "La Spezia", concept: "italienisch/mediterran" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill" },
    ],
    bars: [
      "Diamant Bar (Aufpreis)",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Galerie Bar",
      "Meerleben Bar (Deck 4)",
      "Grööne Bar",
      "Café Lounge (Kaffee & Pralinen)",
      "Champagner Treff (Aufpreis)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar",
      "Casino & Lounge",
      "X-Lounge (exklusiv für Suiten)",
    ],
    deckplan:
      "15 Decks (12 für Gäste). Deck 3: Rezeption/Atlantik/Theater/Hospital. Deck 4: Theater, Atelier, Meerleben Bar. Deck 5: Restaurants, Shoppingpassage 'Neuer Wall', Abtanz Bar, Klanghaus. Deck 6-10 Kabinen. Deck 11: SPA-Balkonkabinen/Sauna. Deck 12: Pool, Anckelmannsplatz, Fitness. Deck 14/15: Arena, Kids, Sonnendecks.",
    spa: "SPA & Meer (ca. 1.700 m² Spa & Sport), Zen-Garten. Erstes Schiff der Flotte mit 25-Meter-Außenpool (Deck 12, Trennwand bei Seegang) sowie Innenpool mit Whirlpool und Ruhelandschaft. Finnische Sauna, Salzsauna, Kräutersauna, Rasul. Moderner Fitnessraum. Außen: ca. 280 m Joggingstrecke, Sportarena, 'Blauer Balkon' (Glasboden, 37 m über dem Meer).",
    bordprogramm:
      "Theater im Bug, dreistöckig, 1.000 Sitzplätze. Zweite Bühne Klanghaus (270 m², bis 300 Plätze) - weltweit erste kammermusikalische Philharmonie auf See, Kooperationen u. a. mit dem Deutschen Symphonie-Orchester Berlin und dem Schlosspark Theater Berlin (Dieter Hallervorden). Kids-Club 'Insel der Seeräuber' (3-11), Babyraum, Teens-Lounge (Ferien). Show-Ensemble, Live-Musik, Casino, Workshops/Verkostungen.",
  },
  {
    ship_name: "Mein Schiff 4",
    baujahr: "2015",
    indienststellung: "Juni 2015 (Taufe 5.6.2015 Kiel, Patin Franziska van Almsick), Renovierung Februar 2020 (Marseille)",
    werft: "STX Finland Oy, Turku",
    brz: "99.526",
    laenge: "293,2 m",
    breite: "35,8 m",
    tiefgang: "8,05 m",
    geschwindigkeit: "ca. 21,7 kn",
    paxDoppel: "2.506",
    paxMax: "ca. 2.700, ungesichert",
    kabinen: "1.253 (825 mit Balkon, 70 Suiten, 32 barrierefrei)",
    decks: "15",
    crew: "1.030",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit: "Baugleich mit Mein Schiff 3; nach der Renovierung 2020 wurden La Spezia und Hanami erneuert, Juice Bar neu.",
    inklusive: [
      { name: "Atlantik - Klassik/Mediterran/Brasserie", concept: "Hauptrestaurant, Service am Platz" },
      { name: "Anckelmannsplatz", concept: "Buffet" },
      { name: "GOSCH Sylt", concept: "Fisch" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "Snacks" },
      { name: "Eis Bar", concept: "Eis" },
    ],
    aufpreis: [
      { name: "Hanami - by Tim Raue", concept: "japanisch/asiatisch" },
      { name: "La Spezia", concept: "italienisch" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill, Barbecue-Grilltische" },
    ],
    bars: [
      "Diamant Bar (Aufpreis)",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Galerie Bar",
      "Waterkant Bar & Lounge",
      "Champagner Treff (Aufpreis)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar",
      "Casino & Lounge",
      "Juice Bar (Aufpreis, seit Renovierung 2020)",
      "X-Lounge (exklusiv für Suiten)",
    ],
    deckplan:
      "15 Decks, Aufbau wie Mein Schiff 3. Deck 4: Teenslounge. Deck 14: Nest, Kids-Club. Wellness Deck 11-12. Höchster Punkt: Ausguck Deck 15.",
    spa: "SPA & Meer (ca. 1.700-1.900 m²), 25-m-Außenpool + Innenpool, Saunalandschaft, vergrößerter Fitnessbereich, Cycling-Raum. Außen: Sportarena, ca. 280 m Joggingstrecke.",
    bordprogramm:
      "Theater, 1.000 Sitzplätze. Klanghaus (bis 300 Plätze, Kammermusik). Kids-Club 'Insel der Seeräuber'. Show-Ensemble, Casino, Workshops.",
  },
  {
    ship_name: "Mein Schiff 5",
    baujahr: "2016",
    indienststellung: "Juni/Juli 2016 (Übergabe 20.6.2016, Taufe 15.7.2016 Travemünde, Patin Lena Meyer-Landrut)",
    werft: "Meyer Turku, Finnland",
    brz: "ca. 99.800",
    laenge: "295,3 m",
    breite: "35,8 m",
    tiefgang: "ca. 8,05 m",
    geschwindigkeit: "ca. 21,7 kn",
    paxDoppel: "2.534",
    paxMax: "bis zu 3.123, ungesichert",
    kabinen: "1.267 (rund 80 % mit Balkon)",
    decks: "15 (davon 12 für Gäste)",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit: "Studio mit weltweit erster 3-D-Holografie-Bühne auf einem Kreuzfahrtschiff.",
    inklusive: [
      { name: "Atlantik - Klassik", concept: "Hauptrestaurant (Deck 3, ca. 560 Plätze)" },
      { name: "Atlantik - Mediterran", concept: "Hauptrestaurant mediterran (Deck 4)" },
      { name: "Anckelmannsplatz", concept: "Buffet (Deck 12)" },
      { name: "GOSCH Sylt", concept: "Fisch" },
      { name: "Osteria - Pizza e Pasta", concept: "italienisch, teils Aufpreis" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "Snacks" },
      { name: "Eis Bar", concept: "Eis" },
    ],
    aufpreis: [
      { name: "Hanami - by Tim Raue", concept: "japanisch/asiatisch" },
      { name: "Schmankerl", concept: "alpenländisch" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill, Barbecue-Grilltische" },
    ],
    bars: [
      "Diamant Bar (Aufpreis)",
      "Studio Bar",
      "Nasch Bar",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Galerie Bar",
      "Champagner Treff (Aufpreis)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar",
      "Casino & Lounge",
      "X-Lounge (exklusiv für Suiten)",
    ],
    deckplan:
      "15 Decks, Aufbau wie Mein Schiff 3/4: Rezeption/Nespresso-Bar/Bibliothek Deck 3; Restaurants/Theater/Shops Deck 4-5; Kabinen Deck 6-11; Pool/Buffet/Spa Deck 12; Arena/Kids/Sonnendecks Deck 14/15.",
    spa: "SPA & Meer (ca. 1.800 m², thailändisches Design), 25-Meter-Außenpool (Deck 12, Trennwand bei Seegang), Lagune/Innenpool. Finnische Sauna, Biosauna, Lichtsauna, Kräuterdampfbad, Fußbäder, Wärmeliegen. 16 Anwendungskabinen, Wellmassage 4-D (Gharieni), vegane Kosmetik. Außen: ca. 280 m Joggingstrecke, Trimm-dich-Pfad (Deck 14, sechs Outdoor-Sportgeräte), Sportarena.",
    bordprogramm:
      "Theater im Bug, dreistöckig, 1.000 Sitzplätze. Zweite Bühne Studio mit weltweit erster 3-D-Holografie-Bühne auf einem Kreuzfahrtschiff (u. a. Ute Lemper, Dieter Hallervorden, Cellist Jan Vogler, Breakdance-Weltmeister Flying Steps 'gebeamt'), Studio-Bar. Kids-Club 'Insel der Seeräuber' (3-11), Babyraum, Teens-Lounge. Show-Ensemble, Live-Musik, Casino, Workshops/Verkostungen.",
  },
  {
    ship_name: "Mein Schiff 6",
    baujahr: "2017",
    indienststellung: "Mai/Juni 2017",
    werft: "Meyer Turku, Finnland",
    brz: "ca. 99.800",
    laenge: "295,3 m",
    breite: "35,8 m",
    tiefgang: "7,95 m",
    geschwindigkeit: "ca. 21,7 kn",
    paxDoppel: "2.534",
    paxMax: "ca. 2.750, ungesichert",
    kabinen: "1.267 (über 80 % mit Balkon)",
    decks: "15 (davon 12 für Gäste)",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit: "Baugleich mit Mein Schiff 5, inkl. Holografie-Bühne im Studio. Deck 13 wird an Bord aus Aberglauben nicht ausgeschildert.",
    inklusive: [
      { name: "Atlantik - Klassik/Mediterran", concept: "Hauptrestaurant" },
      { name: "Anckelmannsplatz", concept: "Buffet" },
      { name: "GOSCH Sylt", concept: "Fisch" },
      { name: "Osteria - Pizza e Pasta", concept: "italienisch, teils Aufpreis" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "Snacks" },
      { name: "Eis Bar", concept: "Eis" },
    ],
    aufpreis: [
      { name: "Hanami - by Tim Raue", concept: "japanisch/asiatisch" },
      { name: "Schmankerl", concept: "alpenländisch" },
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill" },
    ],
    bars: [
      "Diamant Bar (Aufpreis)",
      "Studio Bar",
      "Café Bar",
      "Himmel & Meer Lounge",
      "TUI Bar",
      "Schau Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Galerie Bar",
      "Champagner Treff (Aufpreis)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar",
      "Casino & Lounge",
      "X-Lounge (exklusiv für Suiten)",
    ],
    deckplan:
      "15 Decks (Deck 13 nicht ausgeschildert). Deck 4 'Seestern': Theater, Hanami, Atlantik Mediterran, TUI Bar, Studio, LUMAS Galerie. Deck 5 'Pier': Theater, Casino, Abtanz Bar, Restaurants, Diamant Bar, Große Freiheit. Deck 12 'Aqua': Pool, Buffet, Spa, Fitness. Deck 14 'Horizont': Arena, Kids-Club, X-Lounge.",
    spa: "SPA & Meer (ca. 1.800 m²), 25-m-Außenpool + Innenpool/Lagune, Saunalandschaft (finnische Sauna, Kräuterdampfbad, Eisbrunnen), großes Fitnessstudio mit Glasfront. Außen: Arena, ca. 280 m Joggingstrecke, Trimm-dich-Pfad.",
    bordprogramm:
      "Theater, 1.000 Sitzplätze. Studio mit Holografie-Bühne. Casino. Kids-Club 'Insel der Seeräuber'. Escape-Room, Thalia-Leselounge, Show-Ensemble, Live-Musik.",
  },
  {
    ship_name: "Mein Schiff 7",
    baujahr: "2024",
    indienststellung: "Juni 2024 (Übernahme 11.6.2024, Taufe 22./23.6.2024 Kiel, Patin Fenia Kalachani)",
    werft: "Meyer Turku, Finnland",
    brz: "111.500",
    laenge: "315,7 m",
    breite: "35,8 m",
    tiefgang: "ca. 8 m",
    geschwindigkeit: "ca. 21-22 kn",
    paxDoppel: "2.884-2.894",
    paxMax: "ca. 2.894-3.100, ungesichert",
    kabinen: "1.461 (über 80 % mit Balkon, inkl. 12 Innen- und 14 Außen-Einzelkabinen)",
    decks: "15-16",
    crew: "1.000",
    flagge: "Malta, Heimathafen Valletta",
    besonderheit:
      "Modernstes Schiff der Flotte: erstes TUI-Cruises-Schiff mit echten Einzelkabinen, Starlink-Internet, Betrieb mit Marinediesel + Katalysatoren, Landstromanschluss, für Methanolbetrieb vorbereitet.",
    inklusive: [
      { name: "Atlantik - Klassik/Mediterran", concept: "Hauptrestaurant" },
      { name: "Anckelmannsplatz", concept: "Buffet" },
      { name: "Fischmarkt", concept: "Fisch/Meeresfrüchte, mit Gourmetbereich" },
      { name: "GanzSchönGesund - Bistro", concept: "gesunde Küche" },
      { name: "Tag & Nacht - Bistro", concept: "Snacks" },
      { name: "Backstube", concept: "Backwaren" },
      { name: "Bosporus - Snackbar", concept: "Snacks" },
      { name: "Eis Bar", concept: "Eis" },
      { name: "Café Central", concept: "Wiener Kaffeehaus-Konzept" },
    ],
    aufpreis: [
      { name: "Surf & Turf - Steakhouse", concept: "Steaks & Grill" },
      { name: "Hideki - Asiatischer Genuss", concept: "asiatisch, Sushi/Live-Zubereitung, Diamant/Heck" },
      { name: "La Spezia - Italienisch genießen", concept: "italienisch, Konzept Theodor Falser, Diamant/Heck" },
    ],
    bars: [
      "Diamant Bar (rund um die Uhr, Aufpreis)",
      "Himmel & Meer Lounge",
      "Hoheluft Bar (Deck Brise)",
      "Außenalster - Bar & Grill",
      "Abtanz Bar (mit Casino-Ecke)",
      "Schau Bar",
      "Galerie Bar",
      "Überschau Bar",
      "Unverzicht Bar",
      "Café Central",
      "Saftwerft",
      "Champagner Treff (Aufpreis)",
      "Casino & Lounge (Raucher-/Nichtraucherbereich getrennt)",
    ],
    deckplan:
      "15-16 Decks, 14 Passagierdecks. Restaurants/Theater/Rezeption Deck 3-5. 'Große Freiheit'/Diamant mit Hideki, La Spezia und Diamant Bar am Heck (Deck 4/5). Kabinen Deck 6-11. Pool/Buffet/Spa Deck 12. Arena/Kids/Sonnendecks Deck 14/15.",
    spa: "SPA & Meer (großer Bereich wie Mein Schiff 1/2), 25-Meter-Außenpool + zweiter Pool/Innenpool, mehrere Whirlpools, große Saunalandschaft, großes Fitnessstudio. Außen: Open-Air-Arena (Fußball/Basketball), ca. 280 m Joggingstrecke, Trimm-dich-Pfad (Deck 14), Golf-Simulator.",
    bordprogramm:
      "Theater im Bug, dreistöckig, 1.000 Sitzplätze, drehbare Bühne, acht LED-Bildschirme, zusätzlich Open-Air-Kino. Zweite Bühne Schaubühne (ca. 150 Plätze): Comedy, Zauberei, Konzerte. Kids-Club 'Insel der Seeräuber' (3-11), Nest Baby-Raum, Teens-Lounge. Show-Ensemble, Musicals, Live-Musik, DJ, Casino, Open-Air-Kino, Workshops.",
  },
];

const shipTips: ShipTip[] = ships.flatMap(toShipTips);

async function seedShipTips() {
  for (const tip of shipTips) {
    const { error: deleteError } = await supabase
      .from("ship_research")
      .delete()
      .eq("ship_name", tip.ship_name)
      .eq("category", "schiffswissen")
      .eq("title", tip.title)
      .is("cabin_category", null);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("ship_research").insert({
      ship_name: tip.ship_name,
      cabin_category: null,
      category: "schiffswissen",
      title: tip.title,
      content: tip.content,
      source_tier: "B",
      source_name: SOURCE_NAME,
      source_url: null,
      staleness: "zeitlos",
      sort_order: tip.sort_order,
    });
    if (insertError) throw insertError;
    console.log(`ship_research: ${tip.ship_name} - ${tip.title}`);
  }
}

async function main() {
  await seedShipTips();
  console.log(`Fertig: ${shipTips.length} ship_research Zeilen für ${ships.length} Schiffe.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
