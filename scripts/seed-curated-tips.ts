// Einmaliges Seed-Skript für redaktionell kuratierte Tipps (aus PDFs eines
// Reisebüros bzw. eines Erfahrungsberichts), NICHT Teil der laufenden App.
// Füllt port_research (curated = true), ship_research und route_research.
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-curated-tips.ts
//
// Löscht vor dem Einfügen jeweils bestehende curated-Zeilen mit demselben
// (port_name, category, title) bzw. (ship_name/region, category, title), damit
// das Skript wiederholt ausführbar ist, ohne Duplikate anzuhäufen.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

const TUI_SOURCE = "TUI ReiseCenter Reisewelt Joa, Karlstadt";
const ERFAHRUNGSBERICHT_SOURCE = "Erfahrungsbericht Mein Schiff 1 (Mittelamerika-Kreuzfahrt)";

interface PortTip {
  port_name: string;
  category: "insider_tipps" | "ausflug_privat" | "sonstiges";
  title: string;
  content: string;
  source_name: string;
}

interface ShipTip {
  ship_name: string;
  category: "insider_tipps";
  title: string;
  content: string;
  source_name: string;
}

interface RouteTip {
  region: string;
  category: "praktisches" | "insider_tipps" | "sonstiges";
  title: string;
  content: string;
  conditions: string | null;
  source_name: string;
}

// --- PDF 1: NordlandKF_NI_AUG24.pdf (TUI ReiseCenter Reisewelt Joa) ---------
// Ein Eintrag pro Hafen, Stichpunkte als Fließtext zusammengefasst.
const portTips: PortTip[] = [
  {
    port_name: "Oslo",
    category: "insider_tipps",
    title: "Insider-Tipps für Oslo",
    content:
      "Festung Akershus liegt direkt am Oslo Cruise Terminal. Das Rathaus hat eine schöne Sonnenuhr und interessante Geschichte. Die Markthalle Mathallen liegt in der Nähe der Oslo Kommune.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Stavanger",
    category: "insider_tipps",
    title: "Insider-Tipps für Stavanger",
    content:
      "Wanderung auf den Preikestolen: Base Camp mit Café und Sportshop. Colourful Street HOLMEGATE liegt in der Nähe vom Hotel Victoria. Längster Unterwassertunnel der Welt (14,4 km, tiefste Stelle 252 m unter dem Meeresspiegel). Die 3 Schwerter symbolisieren Frieden, Freiheit und Einheit. Sola Beach. Ruinenkirche Sola: dank nummerierter Steine originalgetreu wieder aufgebaut.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Bergen",
    category: "insider_tipps",
    title: "Insider-Tipps für Bergen",
    content:
      "Festung Bergenhus. Stadtviertel Bryggen mit den berühmten bunten schiefen Holzhäusern - Kafe Kaf Bryggen mit leckeren Waffeln mit Sauerrahm und Marmelade. Fischmarkt (Achtung Walfleisch). Fløibanen: Bahn hoch auf den Hausberg Fløyen mit Aussichtsplattform und Rundwanderwegen (floyen.no). Berg Ulriken mit der Ulriksbanen, Transferbus ab Fischmarkt/Hafen zur Talstation (ulriken643.no). Hanseatisches Museum. Marienkirche: älteste Kirche Bergens, seit dem Mittelalter in Gebrauch. Schøtstuene: renovierte Gildenhalle aus Wikingerzeit. Håkonshallen: Königshaus aus der Zeit, als Bergen Hauptstadt Norwegens war. Rosenkrantz-Turm. Aquarium: eines der größten Aquarien Nordeuropas mit Robben und Pinguinen.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Olden",
    category: "insider_tipps",
    title: "Insider-Tipps für Olden",
    content:
      "Mit dem Bus nach Loen Skylift und mit der Seilbahn auf den Hoven. Ausflug zum Briksdal-Gletscher: am besten über die Reederei buchen. Outlet für Outdoor-Kleidung „Skogstad” in der Nähe des Hafenanlegers.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Geiranger",
    category: "insider_tipps",
    title: "Insider-Tipps für Geiranger",
    content:
      "Ausflug zur Adlerkehre. Wasserfall Storfossen und Spaziergang zum Besucherzentrum Geiranger Fjord (327 Stufen). Tolle Cafés „Fjordnaer” und „Café Geiranger” mit superleckerer Schokolade („Sjokolade”). Unbedingt Ein- und/oder Ausfahrt genießen - die sieben Schwestern und der Freier (Wasserfälle). Wanderung ab Hellesylt nach Geiranger über das Flogebirge: am besten über Reederei buchen. Dalsnibba: Aussichtsplattform in 1.476 m Höhe mit spektakulärem Blick in den Geirangerfjord. Adlerpanoramastraße mit 11 Serpentinen. RIB-Bootstour mit „Bonseye”.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Ålesund",
    category: "insider_tipps",
    title: "Insider-Tipps für Ålesund",
    content:
      "Altstadt: einzigartige Architektur durch gemauerte Häuser im Jugendstil - nach einem Brand wurde die ursprüngliche Holzhausstadt so wieder aufgebaut. Hausberg Aksla: über steile lange Treppe, steilen Pfad oder Bimmelbahn erreichbar, toller Panoramablick über Ålesund und seine Inseln. Diverse Museen: Jugendstil-Museum in der ehemaligen Svane-Apotheke, Kunstmuséet KUBE, Museum der Stadtgeschichte, Fischereimuseum, Sunnmøre Museum (Freilichtmuseum mit alter Boots-Sammlung). Spaziergang im Stadtpark.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Eidfjord",
    category: "insider_tipps",
    title: "Insider-Tipps für Eidfjord",
    content:
      "Ausflug zum Hardangervidda: Europas größte Hochebene und Norwegens größter Nationalpark. Vøringsfossen Wasserfall. Måbødalen Tal.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Trondheim",
    category: "insider_tipps",
    title: "Insider-Tipps für Trondheim",
    content:
      "Fluss Nidelva schlängelt sich durch die Stadt. Nidarosdom: Wahrzeichen der Stadt, mittelalterlicher Sakralbau, hier fanden bis 1906 Krönungen statt, große Rosette. Stiftsgården: Königsresidenz mit schönem Garten. Speicherstadt mit schönen Holzhäusern und der Gamle Bybru (ehemalige Holz-Zugbrücke), direkt daneben der erste Fahrradlift der Welt (Straße Brubakken). Festung Kristiansten: steiler Aufstieg zu Fuß, 300 Jahre alte Festung, schöner Ausblick über die Stadt. Thomas Angells Gate: mit bunten Regenschirmen überspannte Straße. Freilichtmuseum Sverresborg.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Måløy",
    category: "insider_tipps",
    title: "Insider-Tipps für Måløy",
    content:
      "Überall große Hauswand-Graffitis. Kannesteinen: ein durch Wasser zu einer Sanduhr geformter Fels. Berg Veten: anspruchsvolle Rundwanderung mit knapp 7 km. Leuchtturm Kråkenes. Fischereimuseum. Refviksanden. Måløyraid Senter Museum.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Flåm",
    category: "insider_tipps",
    title: "Insider-Tipps für Flåm",
    content:
      "Flåmsbahn: tolle Bahnstrecke, eingeweiht Anfang der 1940er, bewältigt auf 20 km bis Myrdal fast 900 Höhenmeter und passiert 20 Tunnel. Flåmsbahn-Museum. Flåm Kirke: stammt aus dem Jahr 1667, etwa 1.500 m talwärts im Zentrum des Dorfes. Gudvangen: Wikingermuseum. Wanderung zum Fretheim Kulturpark. Ausflug nach Voss (1 ½ Std. Fahrzeit einfach) - unterwegs lassen sich das Wikingerdorf in Gudvangen und der Wasserfall Tvindefossen gut einbauen.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Åndalsnes",
    category: "insider_tipps",
    title: "Insider-Tipps für Åndalsnes",
    content: "Mit der Romsdalen Gondola auf den Berg - am besten früh losgehen.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Molde",
    category: "insider_tipps",
    title: "Insider-Tipps für Molde",
    content: "Bummeln am Kai. Fjordsauna (naustamolde.no).",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Svolvær",
    category: "insider_tipps",
    title: "Insider-Tipps für Svolvær (Lofoten)",
    content:
      "Traditioneller Ort des Fischfangs, kombiniert mit moderner Architektur, Hotels und Restaurants. Bootsfahrt in den Trollfjord möglich.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Tromsø",
    category: "insider_tipps",
    title: "Insider-Tipps für Tromsø",
    content: "Eismeerkathedrale. Fjellheisen Seilbahn - tolle Aussicht. Pulsierende Arktik-Stadt mit studentischem Flair.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Honningsvåg",
    category: "insider_tipps",
    title: "Insider-Tipps für Honningsvåg (Nordkap)",
    content:
      "Magische Mitternachtssonne im Sommer und Polarlichter im Winter. Symbolischer „nördlichster Punkt Europas” (mit Auto/Bus erreichbar) und spektakulärer Aussichtspunkt.",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Kopenhagen",
    category: "insider_tipps",
    title: "Insider-Tipps für Kopenhagen",
    content:
      "Tivoli Vergnügungspark. Die kleine Meerjungfrau. Gefion Brunnen. Nyhavn Stadtviertel - hier gibt es leckeres Softeis. Schloss Amalienborg (Wachablösung gegen 11:30 Uhr).",
    source_name: TUI_SOURCE,
  },
  {
    port_name: "Göteborg",
    category: "insider_tipps",
    title: "Insider-Tipps für Göteborg",
    content:
      "Stadt durch Shuttle/Taxi erreichbar. Volvomuseum. Stadtviertel HAGA mit kleinen Läden, Cafés und leckeren Zimtschnecken. Markthalle Saluhallen.",
    source_name: TUI_SOURCE,
  },

  // --- PDF 2: Mittelamerika-Kreuzfahrt mit der Mein Schiff 1 (Erfahrungsbericht) ---
  {
    port_name: "Cozumel",
    category: "ausflug_privat",
    title: "Punta Sur Lagunen und Strand (Leon Tours)",
    content:
      "Nationalpark-Fokus, Krokodil-Sichtung, Mittagessen am Strand. Inklusive Wasser, Softdrinks und Bier im Bus.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Roatán",
    category: "ausflug_privat",
    title: "Daniel Johnson's Monkey & Sloth Hang Out + West Bay Beach (Rony's Tours)",
    content:
      "Tierbegegnung (Faultiere/Affen/Papageien), Strandaufenthalt West Bay (Argentinian Grill). Supermarkt für Eigenverpflegung direkt nebenan.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Roatán",
    category: "sonstiges",
    title: "Tierwohl bei Faultieren beachten",
    content:
      "Faultiere sollten nicht „geknuddelt”, sondern nur respektvoll beobachtet werden - besonders relevant in Roatán und Costa Rica (nachhaltiger Tourismus).",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Puerto Limón",
    category: "ausflug_privat",
    title: "Tortuguero Kanäle und Cahuita Nationalpark (Red Frog Tours)",
    content: "Intensive Naturerfahrung per Boot und zu Fuß. Wichtig: Eigenverpflegung (Snacks vom Schiff) einplanen.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Puerto Limón",
    category: "sonstiges",
    title: "Sicherheitslage außerhalb des Terminals",
    content:
      "Die Hafenumgebung ist industriell geprägt und außerhalb der Terminals teils unübersichtlich - kann auf Erstbesucher verunsichernd wirken. Geführte Touren sind hier empfehlenswert.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Colón",
    category: "ausflug_privat",
    title: "T2: Affeninseln, Regenwaldbegehung, Panamakanal (Bis Bald Tours)",
    content: "Bootstour auf dem Panamakanal, Besichtigung der Schleusenanlagen.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Colón",
    category: "sonstiges",
    title: "Original-Reisepass zwingend erforderlich",
    content:
      "In Panama reicht Bordkarte/Personalausweis nicht - der Original-Reisepass ist zwingend nötig. Ohne ihn kann der Wiedereintritt in den Hafen nach einem Ausflug erschwert oder verweigert werden. Zusätzlich ist die Hafenumgebung industriell/teils unübersichtlich - geführte Touren sind empfehlenswert.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "La Romana",
    category: "ausflug_privat",
    title: "Saona Crusoe VIP (SeavisTours)",
    content: "Ganztägige Speedboot-Tour zu exklusiven Stränden. Hochwertige Verpflegung inklusive.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    port_name: "Cartagena",
    category: "sonstiges",
    title: "Port Oasis Zoo direkt am Terminal",
    content:
      "Für Familien mit Kleinkindern oft das Highlight, ohne dass ein Taxi oder eine Tour nötig ist. Morgens meist fast leer, da die meisten Passagiere direkt auf Ausflüge gehen - am Nachmittag sehr voll, wenn die Ausflüge zurückkommen.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
];

const shipTips: ShipTip[] = [
  {
    ship_name: "Mein Schiff 1",
    category: "insider_tipps",
    title: "Allergie- und Unverträglichkeits-Management",
    content:
      "Für Gäste mit Unverträglichkeiten (z. B. Laktoseintoleranz) gibt es einen exzellenten Service: Am Vorabend erhalten Gäste die Menükarte für den Folgetag. Bei einer Bestellung bis 10:00 Uhr vormittags werden die Speisen individuell und sicher nach den Bedürfnissen des Gastes zubereitet.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    ship_name: "Mein Schiff 1",
    category: "insider_tipps",
    title: "Kids-Club außerhalb der Ferienzeiten",
    content: "Außerhalb der Ferienzeiten herrscht eine sehr entspannte Atmosphäre mit individueller Betreuung.",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
];

const routeTips: RouteTip[] = [
  {
    region: "karibik",
    category: "praktisches",
    title: "eSIM statt Bord-WLAN",
    content:
      "Eine eSIM (z. B. eSIMio) ist deutlich kosteneffizienter als die bordeigenen WLAN-Tarife. Es gibt regelmäßig Sonderangebote (z. B. 5 GB für ca. 2 USD), die fast alle Häfen der Route zuverlässig abdecken.",
    conditions: "vor allem in der Karibik/Mittelamerika relevant, wo die Netzabdeckung meist gut ist",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Vorabend-Check-in nutzen",
    content:
      "Sofern die Fluggesellschaft es anbietet (z. B. Discover Airlines), entzerrt der Vorabend-Check-in den Abreisetag massiv und reduziert die Wartezeiten am Flughafen auf ein Minimum.",
    conditions: "nur relevant bei Anreise per Flug",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Gepäck-Splitting",
    content:
      "Die Garderobe pro Person auf mehrere Koffer verteilen - Absicherung, falls ein Gepäckstück verspätet am Zielort eintrifft. Ein Basis-Set im Handgepäck (Badekleidung, Wechselwäsche) ermöglicht die Nutzung der Bordeinrichtungen unmittelbar nach dem Boarding.",
    conditions: null,
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Schutzhülle für Kofferanhänger",
    content:
      "Kunststoffhüllen für die TUI-Kofferanhänger (z. B. über Amazon) verhindern den Verlust der Kabineninformationen während des Transports vom Flughafen zum Schiff.",
    conditions: null,
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Bargeld-Tipp: kleine US-Dollar-Scheine",
    content:
      "Kleine USD-Scheine (1, 5, 10 USD) sind der wichtigste Türöffner für Trinkgelder und Souvenirs - große Scheine werden vor Ort oft nicht gewechselt.",
    conditions: null,
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Kindertransport in lokalen Taxis/Bussen",
    content:
      "In lokalen Taxis und Bussen gibt es meist keine Kindersitze - Kinder werden pragmatisch auf dem Schoß befördert. Das ist vor Ort Standard und wird von den Anbietern nicht beanstandet.",
    conditions: "relevant für Familien mit Kleinkindern",
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
  {
    region: "karibik",
    category: "praktisches",
    title: "Tendering einplanen",
    content:
      "In Häfen wie Grand Cayman oder Belize wird getendert. Das erfordert Geduld und eine zeitige Planung der Landgänge, besonders mit kleinen Kindern.",
    conditions: null,
    source_name: ERFAHRUNGSBERICHT_SOURCE,
  },
];

async function seedPortTips() {
  for (const tip of portTips) {
    const { error: deleteError } = await supabase
      .from("port_research")
      .delete()
      .eq("port_name", tip.port_name)
      .eq("category", tip.category)
      .eq("title", tip.title)
      .eq("curated", true);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("port_research").insert({
      port_name: tip.port_name,
      category: tip.category,
      title: tip.title,
      content: tip.content,
      source_tier: "B",
      source_name: tip.source_name,
      source_url: null,
      staleness: "zeitlos",
      curated: true,
    });
    if (insertError) throw insertError;
    console.log(`port_research: ${tip.port_name} - ${tip.title}`);
  }
}

async function seedShipTips() {
  for (const tip of shipTips) {
    const { error: deleteError } = await supabase
      .from("ship_research")
      .delete()
      .eq("ship_name", tip.ship_name)
      .eq("category", tip.category)
      .eq("title", tip.title);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("ship_research").insert({
      ship_name: tip.ship_name,
      category: tip.category,
      title: tip.title,
      content: tip.content,
      source_tier: "B",
      source_name: tip.source_name,
      source_url: null,
      staleness: "zeitlos",
    });
    if (insertError) throw insertError;
    console.log(`ship_research: ${tip.ship_name} - ${tip.title}`);
  }
}

async function seedRouteTips() {
  for (const tip of routeTips) {
    const { error: deleteError } = await supabase
      .from("route_research")
      .delete()
      .eq("region", tip.region)
      .eq("category", tip.category)
      .eq("title", tip.title);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("route_research").insert({
      region: tip.region,
      category: tip.category,
      title: tip.title,
      content: tip.content,
      conditions: tip.conditions,
      source_tier: "B",
      source_name: tip.source_name,
      source_url: null,
      staleness: "zeitlos",
    });
    if (insertError) throw insertError;
    console.log(`route_research: ${tip.region} - ${tip.title}`);
  }
}

async function main() {
  await seedPortTips();
  await seedShipTips();
  await seedRouteTips();
  console.log(`Fertig: ${portTips.length} port_research, ${shipTips.length} ship_research, ${routeTips.length} route_research Zeilen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
