// Einmaliges Seed-Skript für eine zweite Charge extern recherchierter
// Hafeninformationen (Karibik/Mittelamerika-Häfen), NICHT Teil der laufenden
// App. Format entspricht exakt dem ResearchFinding-Schema aus der
// KI-Websuche-Recherche (siehe port-research.ts/research-schema.ts).
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-port-research-batch2.ts
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
import { googleSearchUrl, lookupWikipediaImage } from "../src/lib/wikimedia.ts";

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
  image_url?: string | null;
  image_source?: "wikipedia" | null;
  article_url?: string | null;
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

// Rohtitel (wie in der Recherche geliefert) -> kanonischer Hafenname, wie er
// auch anderswo im Code verwendet wird (siehe REGION_PORTS in
// route-research.ts bzw. port_name in seed-curated-tips.ts).
const PORT_NAME_MAP: Record<string, string> = {
  "Coxen Hole (Roatán)": "Roatán",
  "George Town (Grand Cayman)": "Grand Cayman",
};

const SHARED_CATEGORIES = new Set([
  "anleger",
  "zu_fuss",
  "essen",
  "praktisches",
  "sehenswuerdigkeiten",
  "wetter_packen",
  "sonstiges",
]);

const findings: RawFinding[] = [
  {
    category: "sehenswuerdigkeiten",
    title: "Montego Bay",
    content:
      "1. Doctor's Cave Beach – berühmter, klarer Sandstrand entlang des „Hip Strip“, gilt seit den 1920ern als einer der schönsten Strände Jamaikas.\n2. Rose Hall Great House – restauriertes Plantagenhaus von 1770 mit Meerblick, bekannt für die Legende um Annie Palmer, die „White Witch of Rose Hall“.\n3. Sam Sharpe Square – zentraler Platz im Herzen der Stadt, benannt nach dem jamaikanischen Nationalhelden und Anführer des Weihnachtsaufstands.\n4. Rocklands Bird Sanctuary – grünes Anwesen, in dem einheimische und exotische Vogelarten aus der Hand gefüttert werden können.\n5. Montego Bay Cultural Centre – Galerie und Museum direkt am Sam Sharpe Square mit wechselnden Ausstellungen zu Kunst und Geschichte Jamaikas.",
    items: [
      { name: "Doctor's Cave Beach", description: "Berühmter, klarer Sandstrand entlang des „Hip Strip“, gilt seit den 1920ern als einer der schönsten Strände Jamaikas." },
      { name: "Rose Hall Great House", description: "Restauriertes Plantagenhaus von 1770 mit Meerblick, bekannt für die Legende um Annie Palmer, die „White Witch of Rose Hall“." },
      { name: "Sam Sharpe Square", description: "Zentraler Platz im Herzen der Stadt, benannt nach dem jamaikanischen Nationalhelden und Anführer des Weihnachtsaufstands." },
      { name: "Rocklands Bird Sanctuary", description: "Grünes Anwesen, in dem einheimische und exotische Vogelarten aus der Hand gefüttert werden können." },
      { name: "Montego Bay Cultural Centre", description: "Galerie und Museum direkt am Sam Sharpe Square mit wechselnden Ausstellungen zu Kunst und Geschichte Jamaikas." },
    ],
    source_tier: "B", source_name: "discovernauts.com / viator.com",
    source_url: "https://www.discovernauts.com/de/reisefuehrer/staedte/jamaika-staedte/montego-bay-sehenswuerdigkeiten/",
    staleness: "zeitlos",
  },
  { category: "anleger", title: "Montego Bay", content: "Kreuzfahrtschiffe legen am Montego Bay Freeport Terminal an, etwa 5 km vom Stadtzentrum entfernt • Am Pier können mehrere Schiffe gleichzeitig festmachen; reicht der Platz nicht, ankern Schiffe vor der Bucht und Passagiere werden per Tenderboot an Land gebracht • Direkt am Terminal gibt es Souvenirgeschäfte, Gastronomie und eine Touristeninformation.", source_tier: "B", source_name: "meine-landausfluege.de", source_url: "https://meine-landausfluege.de/montego-bay-kreuzfahrt-hafenterminal/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Montego Bay", content: "Beliebte eigenständig buchbare Touren: Kombitour Dunn's River Falls & Luminous Lagoon (leuchtendes Plankton) • Rose Hall Great House kombiniert mit Blue Hole • Floßfahrt auf dem Martha Brae River • Stadtrundfahrt mit Sam Sharpe Square, St. James Parish Church und Richmond Hill Great House.", source_tier: "B", source_name: "GetYourGuide / Viator", source_url: "https://www.getyourguide.com/montego-bay-l238/", staleness: "saisonal" },
  { category: "zu_fuss", title: "Montego Bay", content: "Vom Hafen aus sind kaum Ziele zu Fuß erreichbar; für die Stadt wird eine kurze Taxifahrt (ca. 10–15 Minuten) empfohlen, am besten bis zum Sam Sharpe Square im historischen Zentrum • Offizielle Taxis mit JTB-Sticker stehen direkt vor dem Terminal, Fahrpreise sind im Terminal ausgehängt, sollten aber vorab bestätigt werden.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / meine-landausfluege.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/montego-bay-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "essen", title: "Montego Bay", content: "• Margaritaville Montego Bay – bekannte Bar-Restaurant-Kette an der Gloucester Avenue (Hip Strip) mit Wasserrutsche und Live-Musik, ca. 10 Minuten Taxifahrt vom Pier • Pier 1 on the Waterfront – Seafood-Restaurant mit Blick auf den Hafen, seit 1986 in Betrieb.", source_tier: "B", source_name: "Viator / Tripadvisor", source_url: "https://www.viator.com/en-GB/Montego-Bay-attractions/Margaritaville-Caribbean-Montego-Bay/overview/d432-a22436", staleness: "verfällt" },
  { category: "praktisches", title: "Montego Bay", content: "• Währung: Jamaika-Dollar (JMD); US-Dollar werden vielerorts akzeptiert • Sprache: Englisch • Für deutsche und österreichische Staatsangehörige ist für die Einreise nach Jamaika kein Visum erforderlich • Auf Taschendiebe an belebten Orten und Märkten achten.", source_tier: "A", source_name: "meinschiff.com (TUI Cruises)", source_url: "https://www.meinschiff.com/de/ports/montego-bay-jamaika-jamaika-1311", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Cozumel",
    content: "1. San Gervasio – bedeutendste Maya-Ruinenstätte der Insel, einst Pilgerzentrum für die Göttin Ixchel, im Dschungel gelegen.\n2. Chankanaab Beach Adventure Park – Naturpark mit Schnorchelriff, botanischem Garten, Unterwasserskulpturen und Seelöwen-Show.\n3. Punta Sur Eco Beach Park – größtes Naturschutzgebiet der Insel mit Lagunen, Stränden und dem Leuchtturm Faro Celarain.\n4. Palancar Reef – weltbekanntes Tauch- und Schnorchelriff im Cozumel Reefs National Marine Park.\n5. San Miguel de Cozumel – die einzige Stadt der Insel mit Malecón-Uferpromenade, Plaza Central, Geschäften und Restaurants.",
    items: [
      { name: "San Gervasio", description: "Bedeutendste Maya-Ruinenstätte der Insel, einst Pilgerzentrum für die Göttin Ixchel, im Dschungel gelegen." },
      { name: "Chankanaab Beach Adventure Park", description: "Naturpark mit Schnorchelriff, botanischem Garten, Unterwasserskulpturen und Seelöwen-Show." },
      { name: "Punta Sur Eco Beach Park", description: "Größtes Naturschutzgebiet der Insel mit Lagunen, Stränden und dem Leuchtturm Faro Celarain." },
      { name: "Palancar Reef", description: "Weltbekanntes Tauch- und Schnorchelriff im Cozumel Reefs National Marine Park." },
      { name: "San Miguel de Cozumel", description: "Die einzige Stadt der Insel mit Malecón-Uferpromenade, Plaza Central, Geschäften und Restaurants." },
    ],
    source_tier: "B", source_name: "komoot.com / viator.com", source_url: "https://www.komoot.com/de-de/guide/2815568/ausflugsziele-in-cozumel", staleness: "zeitlos",
  },
  { category: "anleger", title: "Cozumel", content: "Cozumel hat drei Kreuzfahrtterminals – welches genutzt wird, hängt von der Reederei ab:\n• Punta Langosta – zentrumsnah, ca. 800 m bzw. 10 Gehminuten von San Miguel entfernt.\n• International Pier – ca. 4,5–5 km südlich des Zentrums.\n• Puerta Maya – größtes und modernstes Terminal, wenige hundert Meter südlich des International Pier.\nBei Vollbelegung wird gelegentlich vor der Küste geankert und mit Tenderbooten an Land gebracht.", source_tier: "B", source_name: "meine-landausfluege.de / kreuzfahrt-kompass.com", source_url: "https://meine-landausfluege.de/cozumel-kreuzfahrt-hafenterminal/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Cozumel", content: "Beliebte eigenständig buchbare Aktivitäten: Schnorchel-/Tauchtour zu Palancar-, Columbia- und Paradise Reef • Kombitour zu Chankanaab, Punta Sur und San Gervasio mit Transport • Sandbank-Ausflug „El Cielo“ • Inselrundfahrt zur wilden Ostküste.", source_tier: "B", source_name: "travelersuniverse.com / one-million-places.com", source_url: "https://www.travelersuniverse.com/cozumel-parks-chankanaab-punta-sur-san-gervasiotransport/", staleness: "saisonal" },
  { category: "zu_fuss", title: "Cozumel", content: "Nur vom Punta Langosta Pier ist das Zentrum San Miguel zu Fuß erreichbar (ca. 10 Minuten) • Von International Pier und Puerta Maya ist wegen der Hitze ein Taxi empfehlenswert; an allen drei Terminals gibt es Taxistände mit ausgehängten Festpreisen.", source_tier: "B", source_name: "kreuzfahrt-kompass.com", source_url: "https://www.kreuzfahrt-kompass.com/haefen/cozumel.html", staleness: "zeitlos" },
  { category: "essen", title: "Cozumel", content: "• Fuego Restaurant – Waterfront-Restaurant mit Panoramablick in San Miguel • COZ Coffee Roasting Company – hausgerösteter Kaffee, ca. 15 Gehminuten vom Hafen • Restaurants entlang des Malecón in San Miguel.", source_tier: "B", source_name: "travel.usnews.com", source_url: "https://travel.usnews.com/features/cozumel-cruise-port-everything-you-need-to-know", staleness: "verfällt" },
  { category: "praktisches", title: "Cozumel", content: "• Währung: Mexikanischer Peso; US-Dollar fast überall akzeptiert • Sprache: Spanisch, im Tourismus auch Englisch • WLAN in vielen Restaurants und an den Cruise Terminals.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/cozumel-auf-eigene-faust/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Costa Maya",
    content: "1. Costa Maya Village – weitläufiges Hafenareal mit Geschäften, Restaurants, Bars und Poolbereich.\n2. Chacchoben-Ruinen – gut erhaltene Maya-Pyramiden (200–700 n. Chr.), ca. 1 Std. Fahrt vom Hafen.\n3. Mahahual – kleines Fischerdorf mit Uferpromenade und Beach-Bars, ca. 4 km vom Terminal.\n4. Leuchtturm von Mahahual – Wahrzeichen an der Promenade.\n5. Kohunlich-Ruinen – weiter im Landesinneren gelegene Maya-Stätte.",
    items: [
      { name: "Costa Maya Village", description: "Weitläufiges Hafenareal mit Geschäften, Restaurants, Bars und Poolbereich." },
      { name: "Chacchoben-Ruinen", description: "Gut erhaltene Maya-Pyramiden (200–700 n. Chr.), ca. 1 Std. Fahrt vom Hafen." },
      { name: "Mahahual", description: "Kleines Fischerdorf mit Uferpromenade und Beach-Bars, ca. 4 km vom Terminal." },
      { name: "Leuchtturm von Mahahual", description: "Wahrzeichen an der Promenade." },
      { name: "Kohunlich-Ruinen", description: "Weiter im Landesinneren gelegene Maya-Stätte." },
    ],
    source_tier: "B", source_name: "kreuzfahrerguide.de / seereiseplanung-kreuzfahrten.de", source_url: "https://kreuzfahrerguide.de/costa-maya-hafen-tipps-ausfluege/", staleness: "zeitlos",
  },
  { category: "anleger", title: "Costa Maya", content: "Das Costa Maya Cruise Terminal liegt rund 4 km außerhalb von Mahahual • An einer knapp 1 km langen Pier können bis zu vier große Schiffe gleichzeitig anlegen • Zu Fuß (10–15 Min.) oder mit kostenlosem Trolleybus geht es zum umzäunten Costa Maya Village.", source_tier: "B", source_name: "kreuzfahrerguide.de / seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/costa-maya-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Costa Maya", content: "Beliebte Ausflüge: Maya-Ruinen Chacchoben (4–5 Std. inkl. Fahrt) • Kombitour Chacchoben & Bacalar-Lagune • Strandtag in Mahahual oder am Maya Chan Beach • geführte Dschungelwanderung.", source_tier: "B", source_name: "leontours.com / kreuzfahrthafen.net", source_url: "https://leontours.com/ausfluege-costa-maya/", staleness: "saisonal" },
  { category: "zu_fuss", title: "Costa Maya", content: "Der Hafen ist weitläufig, kostenloser Trolleybus verkehrt zum Terminalbereich • Mahahual liegt 3–4 km entfernt; Fußweg wegen Hitze nicht empfohlen – Taxi/Shuttle nutzen.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / bucketlistguides.com", source_url: "https://www.seereiseplanung-kreuzfahrten.de/costa-maya-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "essen", title: "Costa Maya", content: "Innerhalb des Costa Maya Village zahlreiche Restaurants/Bars am Pool • In Mahahual Strandrestaurants für frische Meeresfrüchte und Margaritas.", source_tier: "B", source_name: "hafeninfo.de", source_url: "https://hafeninfo.de/hafen/mexiko/puerto-costa-maya-mahahual/", staleness: "verfällt" },
  { category: "praktisches", title: "Costa Maya", content: "• Währung: Mexikanischer Peso; USD im Hafenbereich akzeptiert • Sprache: Spanisch, im Portbereich auch Englisch • Kostenfreies WLAN, Duschen, Geldautomaten und Tourismusinfo vorhanden.", source_tier: "B", source_name: "mykreuzfahrt.de", source_url: "https://www.mykreuzfahrt.de/kreuzfahrten/mexiko/puerto-costa-maya", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Belize City",
    content: "1. Fort Street Tourism Village – gesichertes Ankunftsareal mit Duty-Free-Shops und Restaurants.\n2. St. John's Cathedral – 1812, ältestes europäisches Gebäude Belizes.\n3. Government House / House of Culture – ehemalige Gouverneursresidenz von 1814, heute Museum.\n4. Belizean Handicraft Market Place – Kunsthandwerksmarkt nahe dem Terminal.\n5. Baron Bliss Lighthouse – Leuchtturm an der Uferpromenade.",
    items: [
      { name: "Fort Street Tourism Village", description: "Gesichertes Ankunftsareal mit Duty-Free-Shops und Restaurants." },
      { name: "St. John's Cathedral", description: "1812, ältestes europäisches Gebäude Belizes." },
      { name: "Government House / House of Culture", description: "Ehemalige Gouverneursresidenz von 1814, heute Museum." },
      { name: "Belizean Handicraft Market Place", description: "Kunsthandwerksmarkt nahe dem Terminal." },
      { name: "Baron Bliss Lighthouse", description: "Leuchtturm an der Uferpromenade." },
    ],
    source_tier: "B", source_name: "Cunard / seereiseplanung-kreuzfahrten.de", source_url: "https://www.cunard.com/en-us/ports/belize-city-belize", staleness: "zeitlos",
  },
  { category: "anleger", title: "Belize City", content: "Reiner Tenderhafen: Schiffe ankern 4–6 km vor der Küste, Passagiere werden per Tenderboot (15–30 Min.) zum Fort Street Tourism Village gebracht.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / iqcruising.com", source_url: "https://www.seereiseplanung-kreuzfahrten.de/belize-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Belize City", content: "Beliebte Ausflüge: Maya-Ruinen Altun Ha oder Xunantunich • ATM-Höhle für fitte Teilnehmer • Schnorcheln/Tauchen am Belize Barrier Reef.", source_tier: "B", source_name: "iqcruising.com / cruiseportadvisor.com", source_url: "https://www.iqcruising.com/ports/caribbean/belize-city/overview-main-review-for-cruise-travelers-to-belize-city-port.html", staleness: "saisonal" },
  { category: "zu_fuss", title: "Belize City", content: "Einige Attraktionen liegen fußläufig vom Village entfernt, aber Belize City hat unsichere Viertel; organisierte Touren statt eigenständigem Erkunden werden empfohlen.", source_tier: "B", source_name: "cruiseportadvisor.com / iqcruising.com", source_url: "https://cruiseportadvisor.com/port/belize-city-belize/", staleness: "zeitlos" },
  { category: "essen", title: "Belize City", content: "Restaurants und Bars innerhalb des Fort Street Tourism Village; Essen außerhalb aus Sicherheitsgründen meist nicht empfohlen.", source_tier: "B", source_name: "belizetourismboard.org", source_url: "https://www.belizetourismboard.org/licensing/cruise/", staleness: "verfällt" },
  { category: "praktisches", title: "Belize City", content: "• Währung: Belize-Dollar (2 BZD=1 USD), USD überall akzeptiert • Sprache: Englisch (Amtssprache), auch Kriol/Spanisch/Garifuna • Belize City gilt als unsicherer als andere Karibikhäfen.", source_tier: "B", source_name: "cruisesheet.com", source_url: "https://cruisesheet.com/port/belize-city", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Coxen Hole (Roatán)",
    content: "1. West Bay Beach – bekannter Strand mit Schnorchelmöglichkeit.\n2. West End – entspannter Ortsteil mit Tauchschulen und Bars.\n3. Gumbalimba Park – Naturpark mit Affen, Papageien, Zipline.\n4. Carambola Gardens – botanischer Garten mit Aussichtspunkt.\n5. Maya Key – Privatinsel mit Tierpark und Stränden.",
    items: [
      { name: "West Bay Beach", description: "Bekannter Strand mit Schnorchelmöglichkeit." },
      { name: "West End", description: "Entspannter Ortsteil mit Tauchschulen und Bars." },
      { name: "Gumbalimba Park", description: "Naturpark mit Affen, Papageien, Zipline." },
      { name: "Carambola Gardens", description: "Botanischer Garten mit Aussichtspunkt." },
      { name: "Maya Key", description: "Privatinsel mit Tierpark und Stränden." },
    ],
    source_tier: "B", source_name: "meine-landausfluege.de / seereiseplanung-kreuzfahrten.de", source_url: "https://meine-landausfluege.de/roatan-kreuzfahrt-ausfluege/", staleness: "zeitlos",
  },
  { category: "anleger", title: "Coxen Hole (Roatán)", content: "Mein Schiff legt am Coxen Hole Main Pier (Port of Roatán) an, betrieben von Royal Caribbean, am Rand der Inselhauptstadt • Weitere Schiffe ankern bei Vollbelegung und tendern • Das Mahogany Bay Cruise Center (~8 km entfernt) wird von Mein Schiff nicht genutzt.", source_tier: "A", source_name: "kreuzfahrertipps.de", source_url: "https://www.kreuzfahrertipps.de/karibik/roat%C3%A1n-honduras/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Coxen Hole (Roatán)", content: "Inselrundfahrt zu West Bay und West End • Schnorchel-/Tauchausflüge am Barrier Reef • Besuch von Gumbalimba Park oder dem Tier-Schutzgebiet French Cay.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / adventourbegins.com", source_url: "https://www.seereiseplanung-kreuzfahrten.de/roatan-auf-eigene-faust/", staleness: "saisonal" },
  { category: "zu_fuss", title: "Coxen Hole (Roatán)", content: "Coxen Hole liegt direkt am Hafentor und ist zu Fuß erreichbar, bietet aber kaum Sehenswürdigkeiten • Strände wie West Bay liegen mehrere Kilometer entfernt, nur per Taxi/Ausflug erreichbar.", source_tier: "B", source_name: "kreuzfahrerguide.de", source_url: "https://kreuzfahrerguide.de/roatan-hafen-tipps-ausfluege/", staleness: "zeitlos" },
  { category: "essen", title: "Coxen Hole (Roatán)", content: "Captain Jack's Seafood Island Bar – beliebtes Restaurant mit Blick auf die Kreuzfahrtschiffe.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/roatan-auf-eigene-faust/", staleness: "verfällt" },
  { category: "praktisches", title: "Coxen Hole (Roatán)", content: "• Währung: Honduras-Lempira; USD fast überall akzeptiert • Sprache: Spanisch, im Tourismus auch Englisch • Kein Uber, Taxis sind Hauptverkehrsmittel.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/roatan-auf-eigene-faust/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Puerto Limón",
    content: "1. Parque Vargas – Park am Hafen mit frei lebenden Faultieren.\n2. Catedral Sagrado Corazón de Jesús – Hauptkirche im Zentrum.\n3. Mercado Municipal – städtischer Markt.\n4. Muelle de los Turistas – bunt bemalter Kreuzfahrtpier, Fotomotiv.\n5. Isla Uvita – Insel, an der 1502 Kolumbus landete.",
    items: [
      { name: "Parque Vargas", description: "Park am Hafen mit frei lebenden Faultieren." },
      { name: "Catedral Sagrado Corazón de Jesús", description: "Hauptkirche im Zentrum." },
      { name: "Mercado Municipal", description: "Städtischer Markt." },
      { name: "Muelle de los Turistas", description: "Bunt bemalter Kreuzfahrtpier, Fotomotiv." },
      { name: "Isla Uvita", description: "Insel, an der 1502 Kolumbus landete." },
    ],
    source_tier: "B", source_name: "kreuzfahrerguide.de / ahoi-schiff.de", source_url: "https://kreuzfahrerguide.de/puerto-limon-hafen-tipps-ausfluege/", staleness: "zeitlos",
  },
  { category: "anleger", title: "Puerto Limón", content: "Schiffe legen am Muelle de los Turistas an, südlich des Zentrums; ein weiterer Liegeplatz an der Muelle Alemán 4-3 daneben • Touristeninformation und lokale Ausflugsanbieter im Terminal.", source_tier: "B", source_name: "meine-landausfluege.de / seereiseplanung-kreuzfahrten.de", source_url: "https://meine-landausfluege.de/puerto-limon-kreuzfahrt-hafenterminal/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Puerto Limón", content: "Bootstour durch die Kanäle des Tortuguero-Nationalparks • Ziplining/Seilbahn im Veragua-Regenwald • Ausflug in den Cahuita-Nationalpark.", source_tier: "B", source_name: "meine-landausfluege.de / kreuzfahrertipps.de", source_url: "https://meine-landausfluege.de/puerto-limon-kreuzfahrt-ausfluege/", staleness: "saisonal" },
  { category: "zu_fuss", title: "Puerto Limón", content: "Das Stadtzentrum mit Kathedrale und Markt ist bequem zu Fuß erreichbar, ebenso der direkt angrenzende Parque Vargas.", source_tier: "B", source_name: "kreuzfahrerguide.de", source_url: "https://kreuzfahrerguide.de/puerto-limon-hafen-tipps-ausfluege/", staleness: "zeitlos" },
  { category: "praktisches", title: "Puerto Limón", content: "• Währung: Costa-Ricanischer Colón; USD vielerorts akzeptiert • Sprache: Spanisch • Auf Taschendiebe an Märkten achten.", source_tier: "B", source_name: "meine-landausfluege.de", source_url: "https://meine-landausfluege.de/puerto-limon-kreuzfahrt-hafenterminal/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Colón",
    content: "1. Colón 2000 Duty Free Mall – Einkaufszentrum am Terminal.\n2. Agua Clara Visitor Center – Aussicht auf die neuen Panamakanal-Schleusen.\n3. Gatun-Schleusen und Gatun-See – historische Original-Schleusenanlage.\n4. Fort San Lorenzo – UNESCO-Festung von 1564.\n5. Portobelo – UNESCO-Kolonialstadt in der Nähe.",
    items: [
      { name: "Colón 2000 Duty Free Mall", description: "Einkaufszentrum am Terminal." },
      { name: "Agua Clara Visitor Center", description: "Aussicht auf die neuen Panamakanal-Schleusen." },
      { name: "Gatun-Schleusen und Gatun-See", description: "Historische Original-Schleusenanlage." },
      { name: "Fort San Lorenzo", description: "UNESCO-Festung von 1564." },
      { name: "Portobelo", description: "UNESCO-Kolonialstadt in der Nähe." },
    ],
    source_tier: "B", source_name: "solencruises.de / kreuzfahrt-praxis.de", source_url: "https://www.solencruises.de/hafen/colon/", staleness: "zeitlos",
  },
  { category: "anleger", title: "Colón", content: "Schiffe legen vorrangig am Colón 2000 Cruise Terminal an; ein zweites Terminal liegt wenige hundert Meter nördlich • Der Cristóbal Pier (~5 km) wird kaum noch genutzt.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / cruvidu.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/colon-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "ausflug_offiziell", title: "Colón", content: "Bootsfahrt durch den Panamakanal • Besuch der Emberá-Indianer im Chagres-Nationalpark • Tagesausflug nach Panama City inkl. Balboa.", source_tier: "B", source_name: "kreuzfahrt-praxis.de", source_url: "https://www.kreuzfahrt-praxis.de/kreuzfahrt-ziele/colon-panama/colon-panama-sehenswuerdigkeiten", staleness: "saisonal" },
  { category: "zu_fuss", title: "Colón", content: "Fußgängerbrücke führt vom Schiff direkt in die gesicherte Mall • Von eigenständigem Spaziergang durch die Stadt wird dringend abgeraten (hohe Kriminalität).", source_tier: "B", source_name: "cruvidu.de / solencruises.de", source_url: "https://www.solencruises.de/hafen/colon/", staleness: "zeitlos" },
  { category: "essen", title: "Colón", content: "Restaurants innerhalb des gesicherten Colón-2000-Terminals; außerhalb aus Sicherheitsgründen nicht empfohlen.", source_tier: "B", source_name: "kreuzfahrt-praxis.de", source_url: "https://www.kreuzfahrt-praxis.de/kreuzfahrt-ziele/colon-panama", staleness: "verfällt" },
  { category: "praktisches", title: "Colón", content: "• Währung: US-Dollar (offiziell in Panama) • Sprache: Spanisch, oft auch Englisch • Sicherheitshinweis: Stadtgebiet gilt als besonders kriminell – Aufenthalt aufs Terminal bzw. organisierte Ausflüge beschränken.", source_tier: "B", source_name: "solencruises.de", source_url: "https://www.solencruises.de/hafen/colon/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Cartagena",
    content: "1. Ciudad Amurallada – ummauerte Altstadt, UNESCO-Welterbe.\n2. Castillo San Felipe de Barajas – Festung von 1536.\n3. Puerta del Reloj und Plaza de los Coches – Haupttor und historischer Platz.\n4. Iglesia de San Pedro Claver – Kirche mit Museum.\n5. Museo Naval del Caribe – Marinemuseum im Jesuitenkloster.",
    items: [
      { name: "Ciudad Amurallada", description: "Ummauerte Altstadt, UNESCO-Welterbe." },
      { name: "Castillo San Felipe de Barajas", description: "Festung von 1536." },
      { name: "Puerta del Reloj und Plaza de los Coches", description: "Haupttor und historischer Platz." },
      { name: "Iglesia de San Pedro Claver", description: "Kirche mit Museum." },
      { name: "Museo Naval del Caribe", description: "Marinemuseum im Jesuitenkloster." },
    ],
    source_tier: "B", source_name: "kreuzfahrt-praxis.de / meine-landausfluege.de", source_url: "https://www.kreuzfahrt-praxis.de/kreuzfahrt-ziele/cartagena-kolumbien/cartagena-kolumbien-sehenswuerdigkeiten", staleness: "zeitlos",
  },
  { category: "anleger", title: "Cartagena", content: "Terminal Marítimo de Cartagena, ca. 4–5 km von der Altstadt entfernt, mit kleinem Park (Flamingos, Papageien, Affen) am Ausgang • Kostenlose Shuttlebusse (500–600 m) vom Schiff zum Terminal.", source_tier: "B", source_name: "meine-landausfluege.de / kreuzfahrt-praxis.de", source_url: "https://meine-landausfluege.de/cartagena-de-indias-kreuzfahrt-hafenterminal/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Cartagena", content: "Rundgang durch die Altstadt • Hop-on-Hop-off-Bus inkl. City Pass • Bootsausflug zu den Islas del Rosario.", source_tier: "B", source_name: "aida.de / meine-landausfluege.de", source_url: "https://aida.de/hafen/cartagena-kolumbien", staleness: "saisonal" },
  { category: "zu_fuss", title: "Cartagena", content: "Die Altstadt selbst ist gut zu Fuß erkundbar, ist aber vom Hafen ca. 4 km entfernt – Taxifahrt (~15 Min., ca. 10 USD) empfohlen.", source_tier: "B", source_name: "kreuzfahrt-praxis.de / seereiseplanung-kreuzfahrten.de", source_url: "https://www.kreuzfahrt-praxis.de/kreuzfahrt-ziele/cartagena-kolumbien/cartagena-kolumbien-individuelle-touren/ein-tag-in-cartagena", staleness: "zeitlos" },
  { category: "praktisches", title: "Cartagena", content: "• Währung: Kolumbianischer Peso • Sprache: Spanisch • Gilt tagsüber bei Kreuzfahrtbetrieb als sicher • Für die Rückfahrt zum Hafen wegen Staus 1,5–2 Std. Puffer einplanen.", source_tier: "B", source_name: "cruisingmatze.com", source_url: "https://cruisingmatze.com/haefen/cartagena-eigene-faust/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "La Romana",
    content: "1. Altos de Chavón – Nachbau eines mediterranen Künstlerdorfes.\n2. Casa de Campo Resort – Luxusanlage mit Golfplätzen.\n3. Isla Saona – Trauminsel für Bootsausflüge.\n4. Isla Catalina – unbewohnte Insel für Strand/Schnorcheln.\n5. La Romana Altstadt – koloniales Zentrum.",
    items: [
      { name: "Altos de Chavón", description: "Nachbau eines mediterranen Künstlerdorfes." },
      { name: "Casa de Campo Resort", description: "Luxusanlage mit Golfplätzen." },
      { name: "Isla Saona", description: "Trauminsel für Bootsausflüge." },
      { name: "Isla Catalina", description: "Unbewohnte Insel für Strand/Schnorcheln." },
      { name: "La Romana Altstadt", description: "Koloniales Zentrum." },
    ],
    source_tier: "B", source_name: "meine-landausfluege.de / e-hoi.de", source_url: "https://meine-landausfluege.de/la-romana-auf-eigene-faust/", staleness: "zeitlos",
  },
  { category: "anleger", title: "La Romana", content: "Terminal im Bereich des Casa de Campo Resorts, ca. 3,5 km vom Zentrum • Zwei Piers in La Romana plus einer auf Isla Catalina • „Chu Chu Train“ für kurze Orientierungsfahrt.", source_tier: "B", source_name: "cruiselaromana.com / meine-landausfluege.de", source_url: "https://cruiselaromana.com/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "La Romana", content: "Bootsausflug zur Isla Saona • geführter Rundgang durch Altos de Chavón • Strandtag in Bayahibe • Cotubanama-Nationalpark mit Cenoten.", source_tier: "B", source_name: "cruvidu.de", source_url: "https://www.cruvidu.de/touren-in-la-romana", staleness: "saisonal" },
  { category: "zu_fuss", title: "La Romana", content: "Stadtzentrum liegt ca. 3,5 km vom Terminal entfernt, nicht fußläufig – Taxi nötig • Altos de Chavón erfordert Anmeldung am Eingang des Casa-de-Campo-Geländes.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/la-romana-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "praktisches", title: "La Romana", content: "• Währung: Dominikanischer Peso; USD häufig akzeptiert, Kartenzahlung vielerorts möglich • Sprache: Spanisch • WLAN im Terminal, an Land eSIM empfehlenswert.", source_tier: "B", source_name: "meine-landausfluege.de / seereiseplanung-kreuzfahrten.de", source_url: "https://meine-landausfluege.de/la-romana-auf-eigene-faust/", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "Ocho Rios",
    content: "1. Dunn's River Falls – bekannteste Sehenswürdigkeit Jamaikas, begehbare Wasserfälle bis zum Meer.\n2. Mystic Mountain – Abenteuerpark mit Sessellift und Bobsled.\n3. Konoko Falls & Park – ruhigere Alternative mit botanischem Garten.\n4. Island Village – Einkaufszentrum am Hafen mit Margaritaville.\n5. Fern Gully – Regenwaldstraße im Hinterland.",
    items: [
      { name: "Dunn's River Falls", description: "Bekannteste Sehenswürdigkeit Jamaikas, begehbare Wasserfälle bis zum Meer." },
      { name: "Mystic Mountain", description: "Abenteuerpark mit Sessellift und Bobsled." },
      { name: "Konoko Falls & Park", description: "Ruhigere Alternative mit botanischem Garten." },
      { name: "Island Village", description: "Einkaufszentrum am Hafen mit Margaritaville." },
      { name: "Fern Gully", description: "Regenwaldstraße im Hinterland." },
    ],
    source_tier: "B", source_name: "aida.de / jamaikatour.de", source_url: "https://www.jamaikatour.de/ocho-rios-sehenswuerdigkeiten/", staleness: "zeitlos",
  },
  { category: "anleger", title: "Ocho Rios", content: "Die meisten Schiffe machen am Ocho Rios Cruise Terminal (Turtle Bay Pier) fest, mit Touristeninformation, Taxistand und Margaritaville-Filiale.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / aida.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/ocho-rios-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "Ocho Rios", content: "Besteigen der Dunn's River Falls (früh morgens ideal) • River Tubing auf dem White River kombiniert mit Dunn's River Falls • Mystic-Mountain-Adventure-Package.", source_tier: "B", source_name: "shoreexcursioneer.com / cruisingmatze.com", source_url: "https://www.shoreexcursioneer.com/ocho-rios/dunns-river-falls-river-tubing.html", staleness: "saisonal" },
  { category: "zu_fuss", title: "Ocho Rios", content: "Island Village mit kleinem Strand ist in wenigen Gehminuten vom Pier erreichbar • Dunn's River Falls liegen ca. 4 km entfernt – nicht fußläufig, Taxi/Ausflug nötig.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / auf-eigene-faust.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/ocho-rios-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "essen", title: "Ocho Rios", content: "Margaritaville Ocho Rios im Island Village – Restaurant/Bar mit Pool und Strandabschnitt, wenige Gehminuten vom Terminal.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de", source_url: "https://www.seereiseplanung-kreuzfahrten.de/ocho-rios-auf-eigene-faust/", staleness: "verfällt" },
  { category: "praktisches", title: "Ocho Rios", content: "• Währung: Jamaika-Dollar (JMD); USD vielerorts akzeptiert • Sprache: Englisch • Kein Visum für deutsche/österreichische Staatsangehörige nötig.", source_tier: "A", source_name: "meinschiff.com (TUI Cruises)", source_url: "https://www.meinschiff.com/de/ports/montego-bay-jamaika-jamaika-1311", staleness: "saisonal" },

  {
    category: "sehenswuerdigkeiten", title: "George Town (Grand Cayman)",
    content: "1. Seven Mile Beach – einer der bekanntesten Strände der Karibik an der Westküste, ca. 5,5 Meilen lang, mit klarem Wasser und zahlreichen Strandbars.\n2. Stingray City – berühmte Sandbank in der North Sound, auf der zahme Stachelrochen im flachen Wasser gefüttert und berührt werden können.\n3. Cayman Islands National Museum – historisches Gebäude direkt am Hafen mit Ausstellungen zur Geschichte und Kultur der Inseln.\n4. Cayman Turtle Centre – seit 1968 bestehende Meeresschildkrötenfarm, weltweit einzige ihrer Art, Heimat für mehr als 8.000 grüne Meeresschildkröten.\n5. Elmslie United Church – in den 1920er-Jahren von einem Schiffsarchitekten im Stil eines umgedrehten Schiffsrumpfes erbaute Kirche im Zentrum von George Town.",
    items: [
      { name: "Seven Mile Beach", description: "Einer der bekanntesten Strände der Karibik an der Westküste, ca. 5,5 Meilen lang, mit klarem Wasser und zahlreichen Strandbars." },
      { name: "Stingray City", description: "Berühmte Sandbank in der North Sound, auf der zahme Stachelrochen im flachen Wasser gefüttert und berührt werden können." },
      { name: "Cayman Islands National Museum", description: "Historisches Gebäude direkt am Hafen mit Ausstellungen zur Geschichte und Kultur der Inseln." },
      { name: "Cayman Turtle Centre", description: "Seit 1968 bestehende Meeresschildkrötenfarm, weltweit einzige ihrer Art, Heimat für mehr als 8.000 grüne Meeresschildkröten." },
      { name: "Elmslie United Church", description: "In den 1920er-Jahren von einem Schiffsarchitekten im Stil eines umgedrehten Schiffsrumpfes erbaute Kirche im Zentrum von George Town." },
    ],
    source_tier: "B", source_name: "seetours.de / seereisedienst.de", source_url: "https://www.seetours.de/hafen/george-town", staleness: "zeitlos",
  },
  { category: "anleger", title: "George Town (Grand Cayman)", content: "George Town ist ein reiner Tenderhafen: Kreuzfahrtschiffe ankern ca. 1–1,5 km vor der Küste, Passagiere werden per Tenderboot (Fahrzeit ca. 5–20 Minuten) an Land gebracht • Es gibt drei mögliche Tenderanleger auf einer Strecke von ca. 300 m: das Royal Watler Cruise Terminal (Hauptanleger, mit Duty-Free-Shops, Tourbuchungsständen und Bars) sowie North Terminal und South Terminal als Ausweichanleger bei mehreren Schiffen gleichzeitig • Bei zu starkem Wind/Wellengang wird gelegentlich auf den Ausweichanleger Spotts Cruise Landing an der Südküste ausgewichen.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / whatsinport.com", source_url: "https://www.seereiseplanung-kreuzfahrten.de/grand-cayman-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "ausflug_privat", title: "George Town (Grand Cayman)", content: "Beliebte eigenständig buchbare Ausflüge: Stingray City & Coral Gardens Bootstour, oft kombiniert mit einem Stopp am Seven Mile Beach • Schnorchel-/Tauchausflug zum Wrack der USS Kittiwake • Besuch des Cayman Turtle Centre • Ausflug zur Felsformation „Hell“ in West Bay • Fahrt zum Queen Elizabeth II Botanic Garden.", source_tier: "B", source_name: "meine-landausfluege.de / seereiseplanung-kreuzfahrten.de", source_url: "https://meine-landausfluege.de/george-town-grand-cayman-kreuzfahrt-ausfluege/", staleness: "saisonal" },
  { category: "zu_fuss", title: "George Town (Grand Cayman)", content: "Die kleine Hauptstadt George Town lässt sich von allen drei Tenderanlegern aus gut zu Fuß erkunden; entlang der Harbour Drive reihen sich Geschäfte, Restaurants und Bars • Nennenswerte klassische Sehenswürdigkeiten sind in George Town selbst rar, die Stadt besteht größtenteils aus Büros, Banken und Regierungsgebäuden • Seven Mile Beach und Stingray City liegen mehrere Kilometer entfernt und sind nur per Taxi, Bus oder Bootstour erreichbar; ein öffentlicher Busbahnhof liegt ca. 200 m vom Royal Watler Terminal entfernt.", source_tier: "B", source_name: "seereiseplanung-kreuzfahrten.de / thepointsguy.com", source_url: "https://www.seereiseplanung-kreuzfahrten.de/grand-cayman-auf-eigene-faust/", staleness: "zeitlos" },
  { category: "essen", title: "George Town (Grand Cayman)", content: "Grand Old House – historisches Landmark-Restaurant mit gehobener Küche, großer Weinauswahl und Meerblick, südlich von George Town gelegen • entlang der Harbour Drive und in den Einkaufszentren Bayshore Mall und Island Plaza befinden sich zudem zahlreiche Restaurants und Bars in unmittelbarer Hafennähe.", source_tier: "B", source_name: "caymanvisitor.com / caymanislandstourbase.com", source_url: "https://caymanvisitor.com/seven-mile-george-town/", staleness: "verfällt" },
  { category: "praktisches", title: "George Town (Grand Cayman)", content: "• Währung: Cayman-Islands-Dollar (KYD); US-Dollar wird praktisch überall akzeptiert • Sprache: Englisch • Die Cayman Islands sind britisches Überseegebiet und beobachten keine Sommerzeit (Eastern Standard Time ganzjährig) • Taxipreise sind von der Taxi Cab Association auf der Insel festgeschrieben, Handeln ist meist zwecklos.", source_tier: "B", source_name: "ncl.com / iqcruising.com", source_url: "https://www.iqcruising.com/ports/caribbean/grand-cayman/overview-grand-cayman-cruise-port.html", staleness: "saisonal" },
];

function canonicalPortName(rawTitle: string): string {
  return PORT_NAME_MAP[rawTitle] ?? rawTitle;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bilder/Artikel-Links werden - genau wie im echten Recherche-Lauf
// (researchAndSavePort in port-research.ts) - nicht per Websuche geraten,
// sondern deterministisch über die Wikipedia-API nachgeschlagen, bevor die
// Zeilen in port_research landen. Anders als dort NACHEINANDER statt parallel
// (mit kleiner Pause): dieses Skript fragt binnen Sekunden ~20 Sehenswürdig-
// keiten über viele Häfen hinweg ab, was Wikipedias anonymes Rate-Limit
// auslöst und reihenweise stille Fehlschläge (kein Bild) produziert.
async function enrichSightItems(finding: RawFinding, portName: string): Promise<void> {
  if (finding.category !== "sehenswuerdigkeiten" || !finding.items) return;
  const items: SightItem[] = [];
  for (const item of finding.items) {
    const lookup = await lookupWikipediaImage(item.name);
    items.push({
      ...item,
      image_url: lookup.url,
      image_source: lookup.source,
      article_url: lookup.articleUrl ?? googleSearchUrl(`${item.name} ${portName}`),
    });
    await sleep(2500);
  }
  finding.items = items;
}

async function seedShared() {
  const byPort = new Map<string, RawFinding[]>();
  for (const f of findings) {
    if (!SHARED_CATEGORIES.has(f.category)) continue;
    const portName = canonicalPortName(f.title);
    await enrichSightItems(f, portName);
    if (!byPort.has(portName)) byPort.set(portName, []);
    byPort.get(portName)!.push(f);
  }

  for (const [portName, rows] of byPort) {
    // Analog zu researchAndSavePort: nur die nicht-kuratierten (KI-artigen)
    // Zeilen ersetzen, kuratierte Insider-/Ausflugstipps bleiben unberührt.
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
  // ausflug_offiziell ist laut Check-Constraint nicht in port_research
  // erlaubt (siehe schema.sql) - Inhalte sind hier ohnehin generisch und
  // nicht reedereigebunden, daher als ausflug_privat abgelegt.
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
