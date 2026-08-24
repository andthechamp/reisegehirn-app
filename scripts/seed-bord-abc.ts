// Einmaliges Seed-Skript für das Bord-ABC der TUI-Cruises-Flotte
// "Mein Schiff 1-7" + "Mein Schiff Relax" + "Mein Schiff Flow" (praktische
// Bordregeln: Check-in/-out, Bordkarte, Dresscode, verbotene Gegenstände,
// Notfalltelefon usw.). Füllt ship_research (category "bord_abc") - analog zu
// scripts/seed-fleet-dossier.ts, aber als eigenständiges Skript, da eine
// eigene, in sich geschlossene Quelle (offizielles TUI Cruises Bord-ABC,
// Stand Dezember 2025, source_tier "A").
//
// Aufruf:
//   node --env-file=.env.local scripts/seed-bord-abc.ts
//
// staleness bewusst durchgängig "zeitlos" (90 Tage TTL, siehe
// CACHE_TTL_DAYS_BY_STALENESS in src/lib/research-schema.ts) - analog zum
// Grund in seed-fleet-dossier.ts: ein kürzerer Wert würde dazu führen, dass
// ensureShipResearched() den Cache vorzeitig für abgelaufen hält und
// researchAndSaveShip() die hier eingefügten Zeilen (cabin_category IS NULL)
// beim nächsten automatischen Refresh kommentarlos überschreibt.
//
// Löscht vor dem Einfügen jeweils bestehende Zeilen mit demselben
// (ship_name, category, title), damit das Skript wiederholt ausführbar ist,
// ohne Duplikate anzuhäufen.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen. Mit --env-file=.env.local aufrufen.");
}
const supabase = createClient(url, key);

const SOURCE_NAME = "Bord-ABC TUI Cruises Mein Schiff Flotte (Stand Dezember 2025)";

interface Tip {
  title: string;
  content: string;
  sort_order: number;
}

function bullets(items: string[]): string {
  return items.map((i) => `• ${i}`).join(" ");
}

// Themen, die flottenweit identisch gelten (keine ship_name-Abhängigkeit im
// Inhalt selbst) - werden unten pro Schiff dupliziert, da ship_research keine
// "flottenweit"-Markierung kennt (jede Zeile ist an genau ein ship_name
// gebunden, siehe schema.sql).
const sharedTips: Tip[] = [
  {
    title: "Alleinreisende Gäste",
    content: bullets([
      "Zu Beginn jeder Reise Treffen der alleinreisenden Gäste zum lockeren Kennenlernen.",
      "Im Atlantik – Klassik sind während der gesamten Reise zu Beginn des Abendservices Tische für alleinreisende Gäste reserviert.",
    ]),
    sort_order: 0,
  },
  {
    title: "Ärztliche Betreuung",
    content: bullets([
      "Modernes Hospital mit deutschsprachigen Schiffsärzten und vorrangig deutschsprachigen Pflegekräften auf jedem Schiff.",
      "Bordapotheke für allgemeine Erkrankungen, Durchfall, Reiseübelkeit, Notfälle sowie gängige Kindermedikamente – nicht auf Babys/Kleinkinder spezialisiert.",
      "Morgens und abends Sprechzeiten (siehe Tagesprogramm); in dringenden Notfällen auch außerhalb erreichbar, dann Zusatzkosten.",
      "Bezahlung nur per Bordkarte, keine Abrechnung per Versichertenkarte – rechtlich ein Arztbesuch im Ausland (Flaggenstaat Malta), deutsche Gebührenrichtlinien gelten nicht.",
      "Medikamente nur nach ärztlicher Konsultation – private Auslandsreise-Krankenversicherung wird empfohlen.",
      "Chronisch Kranke sollten Krankenunterlagen mitführen und Kostenübernahme vorab mit der Versicherung klären.",
      "Im medizinischen Notfall Ausschiffung ins nächstgelegene Krankenhaus – schnelle Ausschiffung kann nicht garantiert werden.",
      "Dialysen und zahnmedizinische Behandlungen sind an Bord nicht möglich; Peritonealdialyse auf der Kabine nur nach vorheriger Anmeldung.",
      "Behandlung Minderjähriger ohne Eltern nur mit schriftlicher Einverständniserklärung der Erziehungsberechtigten.",
    ]),
    sort_order: 1,
  },
  {
    title: "Ausflüge",
    content: bullets([
      "Landausflüge werden größtenteils von TUI Cruises vermittelt und von örtlichen Agenturen veranstaltet – Durchführung, Verantwortung und Haftung liegen beim jeweiligen örtlichen Veranstalter.",
      "Ein Teil der Ausflüge wird direkt von TUI Cruises veranstaltet (Details unter meinschiff.com/landausfluege).",
      "Restaurant-/Busstandard entspricht nicht überall europäischen Maßstäben; ohne deutschsprachige Reiseleitung ggf. auf Englisch.",
      "Ablauf und Preise können sich jederzeit ändern.",
    ]),
    sort_order: 2,
  },
  {
    title: "Babys und Kleinkinder",
    content: bullets([
      "Babys dürfen erst ab 6 Monaten mitreisen, bei mehr als 3 aufeinanderfolgenden Seetagen erst ab 12 Monaten; vollständiger Impfschutz vorausgesetzt.",
      "Babys bis zum vollendeten 2. Lebensjahr reisen kostenlos.",
      "Baby-Raum \"Nest\" mit Babyspielkreisen, Tobestunden und Workshops für Kinder bis 2 Jahre in Begleitung eines Erziehungsberechtigten.",
      "Babybett (60×120 cm) in den meisten Kabinen möglich – bitte vorab anfragen.",
      "Wasserkocher und Wärmedecken aus Sicherheitsgründen nicht erlaubt; Flaschenwärmer und Sterilisationsgeräte sind erlaubt.",
      "Abgekochtes Wasser/Milch für Babynahrung gibt es in allen Restaurants und der X-Lounge (Thermoskanne empfohlen); Wasser an den Bars ist nicht abgekocht.",
      "Babyphone stehen in begrenzter Anzahl zur Verfügung, Verbindung ist nicht überall garantiert.",
      "Schwimmwindeln sind aus hygienischen Gründen in den Pools nicht gestattet, spezielle Babypools gibt es nicht – windeltragende Kleinkinder können die Pools daher nicht nutzen.",
    ]),
    sort_order: 3,
  },
  {
    title: "Bordkarte",
    content: bullets([
      "Bordkarte = Kabinenschlüssel, Zahlungsmittel (Ausgaben werden dem Kabinenkonto belastet) und persönlicher Ausweis beim Verlassen/Betreten des Schiffs.",
    ]),
    sort_order: 4,
  },
  {
    title: "Check-in",
    content: bullets([
      "Kabine ab spätestens 15:00 Uhr verfügbar; Suiten/Junior Suiten/VIP-Tarif-Gäste haben einen eigenen Check-in.",
      "Online Check-in ist für alle Reiseteilnehmer verpflichtend – früheste Check-in-Zeit und Early-Check-in-Infos stehen in den Reiseunterlagen.",
      "Aus Sicherheitsgründen wird jeder Gast beim Check-in fotografiert (Pflicht, sonst kein Check-in) – Foto wird zur Identifikation gespeichert.",
    ]),
    sort_order: 5,
  },
  {
    title: "Check-out",
    content: bullets([
      "Kabine am Abreisetag bis 09:00 Uhr verfügbar, offizielles Reiseende 11:00 Uhr.",
      "Bei über TUI Cruises gebuchter Abreise: Zeit bis zum Transfer an Bord verbringbar.",
      "Individuell reisende Gäste können den Aufenthalt an der Rezeption gegen Aufpreis verlängern (außer in US-Wechselhäfen) – für Suiten/Junior Suiten/VIP-Tarif bereits inklusive.",
      "Detaillierte Abreiseinformation liegt auf der Kabine.",
    ]),
    sort_order: 6,
  },
  {
    title: "Diätkost und Lebensmittelunverträglichkeiten",
    content: bullets([
      "Unverträglichkeiten und Diätwünsche vorab unter meinschiff.com/meinereise angeben.",
      "Zu Reisebeginn Informationsaustausch mit Fachpersonal zu Diätwünschen, Intoleranzen und Allergien – Teilnahme wird auch bei vorheriger Angabe empfohlen.",
      "Mittags-/Abendmenü aus dem Atlantik – Klassik liegt jeweils für den Folgetag auf der Kabine, danach wird der Menüwunsch serviert.",
    ]),
    sort_order: 7,
  },
  {
    title: "Dresscode",
    content: bullets([
      "Kein formeller Dresscode – klassisch-legerer, temperaturangepasster Kleidungsstil.",
      "Keine Badekleidung/kurze Hosen beim Abendessen im Restaurant; Herren abends bitte geschlossenes Schuhwerk.",
    ]),
    sort_order: 8,
  },
  {
    title: "Elektrische Geräte und Kerzen",
    content: bullets([
      "Jede Kabine hat einen Haartrockner; mitgebrachte Wasserkocher, Bügeleisen, Wärmedecken, Mehrfachstecker und Verlängerungskabel dürfen an Bord nicht benutzt werden (Mehrfachstecker/Verlängerung an der Rezeption erhältlich).",
      "Stecker von Haartrocknern, Glätteisen, Lockenstäben, Babyflaschenwärmern und Sterilisationsgeräten nach Gebrauch stets entfernen.",
      "Kerzen dürfen weder auf der Kabine noch anderswo an Bord abgebrannt werden.",
      "Abgekochtes Wasser aus medizinischen Gründen gibt es in allen Restaurants und der X-Lounge (Thermoskanne empfohlen); Wasser an den Bars ist nicht abgekocht.",
    ]),
    sort_order: 9,
  },
  {
    title: "Gäste mit körperlichen und geistigen Einschränkungen",
    content: bullets([
      "Ausflüge: Ausflugsteam prüft zu Reisebeginn die Vereinbarkeit mit der Beeinträchtigung; Ausflüge mit Schwierigkeitsgrad \"Extraleicht\" sind vorab reservierbar und für eingeschränkte Mobilität (auch faltbarer Rollstuhl) geeignet.",
      "Buchung: Fragebogen für Gäste mit körperlichen Einschränkungen direkt bei Buchung ausfüllen (siehe meinschiff.com/barrierefrei-reisen).",
      "Hilfestellungen jeglicher Art können aus Versicherungsgründen nur von der verantwortlichen Begleitperson geleistet werden – keine Betreuungsmöglichkeiten an Bord, Blindenhunde nicht erlaubt.",
      "Kabinen: Barrierefreie Kabinen vorhanden; Gehörlose, stark Sehbeeinträchtigte (≤5 % Sehschärfe auf dem besseren Auge) und dauerhaft Rollstuhlabhängige dürfen aus Sicherheitsgründen grundsätzlich nur mit volljähriger, nicht beeinträchtigter Begleitperson reisen (Einzelfallprüfung möglich).",
      "Landgang: Bei steilen Gangways oder Tenderbetrieb kann der Landgang/Transport für Rollstuhlfahrer und stark Sehbeeinträchtigte aus Sicherheitsgründen eingeschränkt oder verweigert werden (Entscheidung des Kapitäns, u. a. abhängig von Wetter/Hafensituation).",
    ]),
    sort_order: 10,
  },
  {
    title: "Geldwechsel",
    content: bullets([
      "An der Rezeption können je nach Fahrtgebiet kleinere Mengen (bis 100 Euro) ausgewählter Landeswährungen getauscht werden, gebührenpflichtig und nur gegen Euro-Bargeld (nicht in allen Ländern möglich).",
    ]),
    sort_order: 11,
  },
  {
    title: "Gepäck",
    content: bullets([
      "TUI-Cruises-Kofferanhänger aus den Reiseunterlagen vor der Abreise anbringen.",
      "Gepäck steht zur Kabinenfreigabe an Bord ggf. noch nicht vor der Kabine – Handgepäck mit wichtigsten Utensilien/Wertgegenständen empfohlen.",
    ]),
    sort_order: 12,
  },
  {
    title: "Mitreise Minderjähriger",
    content: bullets([
      "Minderjährige dürfen nicht allein an Bord reisen – mindestens ein Elternteil oder eine erwachsene Begleitperson muss mitreisen.",
      "Schriftliche Einverständniserklärung (mind. Englisch, konsularisch beglaubigt) plus Kopie des Lichtbildausweises der Eltern mitführen – teils auch bei Reise mit nur einem Elternteil nötig.",
      "Vorab bei den Konsulaten/Botschaften der Reiseländer oder auf auswaertiges-amt.de informieren.",
    ]),
    sort_order: 13,
  },
  {
    title: "Kabinen (Geräusche und Klimaanlage)",
    content: bullets([
      "Motoren-, Fahr- und Eigengeräusche sowie Vibrationen sind auf einem Kreuzfahrtschiff unumgänglich, besonders nahe Betriebsräumen, Restaurants, Bars und Pooldeck – im Laufe der Reise gewöhnungsbedürftig, aber meist weniger wahrgenommen.",
      "Klimaanlagen sind einzeln regulierbar; auf Mein Schiff 3 und Mein Schiff 4 nicht komplett abschaltbar, auf den übrigen Schiffen der Flotte abschaltbar (Frischluftzufuhr bleibt bestehen).",
      "In allen Himmel & Meer Suiten und den barrierefreien Kabinen der Mein Schiff Relax ist die Klimaanlage aus Sicherheitsgründen nicht komplett abschaltbar.",
    ]),
    sort_order: 14,
  },
  {
    title: "Kabinen-TV",
    content: bullets([
      "Programm mit aktuellen Spielfilmen, Neuigkeiten zur Flotte und dem Meine Reisen Bordportal.",
      "Deutsche Fernsehsender sind aufgrund örtlicher Gegebenheiten und Satellitenverbindung nicht überall empfangbar.",
    ]),
    sort_order: 15,
  },
  {
    title: "Kinder- und Jugendbetreuung",
    content: bullets([
      "Kids-Club \"Insel der Seeräuber\" für 3- bis 11-Jährige, Teensprogramm (12-17) während der deutschen Ferienzeit.",
      "Voraussetzung: vollständiger Impfschutz nach STIKO-Empfehlung (u. a. 2-fache Masernimpfung), keine Windeln mehr, integrierbarer Entwicklungsstand, Verständigung auf Deutsch oder Englisch.",
      "Kids-Club-Bereiche nur mit Stoppersocken betretbar.",
      "Mindestalter Kids & Teens Programm: 3–11 / 12–17 Jahre.",
      "Ausflüge: Kinder bis 15 Jahre nur in Begleitung der Erziehungsberechtigten, 16–17 Jahre allein nur mit deren Erlaubnis.",
      "Bingo und Casino & Lounge: Teilnahme/Zutritt erst ab 18 Jahren.",
      "Sport & Gesundheit: Kraftgeräte ab 16 Jahren, Cardiogeräte/Fitnesskurse ab 14 Jahren (Eltern haften für ihre Kinder).",
      "SPA & Meer/Sauna: Biosauna 6–11 Jahre in Begleitung (max. 5 Min.), ab 12 Jahre mit Begleitung uneingeschränkt, ab 14 Jahre ohne Begleitung; Wohlfühlanwendungen ab 8 Jahren mit Erlaubnis/Aufsicht.",
      "Abtanz Bar / D4 Club & Lounge: unter 16 Jahren nur in Begleitung eines Erziehungsberechtigten.",
    ]),
    sort_order: 16,
  },
  {
    title: "Kommunikation an Bord",
    content: bullets([
      "WLAN in fast allen öffentlichen Bereichen und Kabinen verfügbar, Empfang teils eingeschränkt (Details: meinschiff.com/digitale-medien/internettarife).",
      "Mobile Endgeräte funktionieren an Bord, aber kostenpflichtig zu den Gebühren des eigenen Mobilfunk-/Roaming-Anbieters – Daten-Roaming zur Kostenvermeidung ausschalten empfohlen.",
      "Kabinentelefon per Satellitenanlage fast weltweit nutzbar, Gebühren werden automatisch auf das Kabinenkonto gebucht.",
    ]),
    sort_order: 17,
  },
  {
    title: "Leitungswasser",
    content: bullets([
      "Leitungswasser an Bord ist kein Trinkwasser – in den Kabinenfluren gibt es Wasserspender zum Auffüllen von Karaffen.",
    ]),
    sort_order: 18,
  },
  {
    title: "Medizinische Nadeln und Spritzen",
    content: bullets([
      "Erlaubt an Bord – bei Bedarf bitte bei der Buchung anmelden, damit Entsorgungsbehälter bereitgestellt werden können.",
      "In öffentlichen Bereichen ausschließlich die speziellen Behälter in den Toiletten zur Entsorgung nutzen.",
    ]),
    sort_order: 19,
  },
  {
    title: "Meine Reisen (Bordportal)",
    content: bullets([
      "Landausflüge, Schönheitsanwendungen und Restaurantreservierungen planen – verfügbar auf der TUI-Cruises-Website, in der Mein Schiff App sowie an Bord auf Touchscreens, im Kabinen-TV und auf dem eigenen mobilen Endgerät.",
      "App-Download vor Reiseantritt empfohlen.",
    ]),
    sort_order: 20,
  },
  {
    title: "Mitnahme medizinischer Geräte",
    content: bullets([
      "Schlafapnoegeräte und Sauerstoffkonzentratoren mit Umgebungsluft sind erlaubt; Sauerstoffkonzentratoren mit Druckgasflaschen/Flüssigsauerstoff sowie Rollstühle mit Nasszellenbatterien nicht.",
      "Gäste mit LVAD sollten die Reise vorab hinsichtlich Seetagen und Gesundheitszustand prüfen lassen und aktuelle medizinische Unterlagen im Handgepäck mitführen.",
      "(Elektrische) Rollstühle/Scooter nach vorheriger Anmeldung erlaubt, Lagerung nur auf der Kabine, Fahrt nur im Schritttempo – elektrische Rollstühle erfordern eine barrierefreie Kabine.",
      "Geräte, die den technischen/Sicherheitsanforderungen nicht entsprechen, werden bei der Sicherheitsprüfung einbehalten.",
    ]),
    sort_order: 21,
  },
  {
    title: "Nichtraucherschutz",
    content: bullets([
      "Alle Kabinen und viele öffentliche Räume sind Nichtraucherbereiche – Rauchen nur auf eigenen Balkonen/Veranden und gekennzeichneten Bereichen (siehe digitales Bordsystem).",
      "Konsum und Weitergabe von Cannabis oder ähnlichen Stoffen ist an Bord grundsätzlich untersagt.",
    ]),
    sort_order: 22,
  },
  {
    title: "Poolsicherheit",
    content: bullets([
      "Im Poolbereich nur Kunststoffgläser – kein Geschirr/Gläser aus anderen Bereichen mitnehmen.",
      "Bei kleinen Nichtschwimmern maximal eine Armlänge entfernt bleiben, auch am Beckenrand; Kinder auch als sichere Schwimmer stets im Blick behalten.",
      "Kostenfreie Schwimmwesten (zwei Größen) an der Handtuchstation, nur unter Aufsicht – schützen nicht vor dem Ertrinken.",
    ]),
    sort_order: 23,
  },
  {
    title: "Post",
    content: bullets([
      "Postkarten werden an der Rezeption gegen Gebühr frankiert und im nächsten Hafen zur Post gegeben.",
      "Zustellung in manchen Ländern (z. B. VAE, Karibik) nicht immer nach deutschem Standard – keine Haftung durch die Reederei.",
    ]),
    sort_order: 24,
  },
  {
    title: "Richtlinien auf unseren Schiffen",
    content: bullets([
      "Verhaltenshinweise für ein gutes Miteinander stehen im digitalen Bordsystem; zusätzlich zum Verhaltenskodex gelten die deutschen Gesetze an Bord.",
    ]),
    sort_order: 25,
  },
  {
    title: "Schwangerschaft",
    content: bullets([
      "Werdende Mütter ab der 24. Schwangerschaftswoche bei Reiseantritt dürfen aus Sicherheitsgründen nicht mitreisen (medizinische Versorgung bei Komplikationen nicht sichergestellt).",
      "Massagen für werdende Mütter werden generell nicht angeboten; Ganzkörperpeelings/-packungen ab dem 4. bis 6. Schwangerschaftsmonat möglich; Gesichtsanwendungen, Maniküre und Pediküre (ohne Massage) uneingeschränkt.",
    ]),
    sort_order: 26,
  },
  {
    title: "Sicherheit und Sicherheitseinweisung",
    content: bullets([
      "Schiffe nach neuesten Sicherheitsstandards, Besatzung nach internationalen Sicherheitsrichtlinien geschult.",
      "Teilnahme an der vorgeschriebenen Sicherheitseinweisung vor dem Auslaufen ist für jeden Passagier verpflichtend (Details im Tagesprogramm, weitere Infos an der Kabinentür-Innenseite).",
    ]),
    sort_order: 27,
  },
  {
    title: "Stromversorgung",
    content: bullets(["Bordnetz mit 220 Volt – ein Reisestecker-Adapter ist nicht notwendig."]),
    sort_order: 28,
  },
  {
    title: "Tenderhafen und Liegeplatz",
    content: bullets([
      "In Tenderhäfen (Ankersymbol im Fahrplan) liegt das Schiff vor Anker; der Liegeplatz kann abseits des Stadtzentrums liegen.",
      "Hafenbehörden können die Ankerposition kurzfristig ändern, worauf TUI Cruises keinen Einfluss hat.",
      "Aus Sicherheitsgründen kann der Kapitän Rollstuhlfahrer und stark Sehbeeinträchtigte (≤5 % Sehschärfe) vom Tenderboot-Transport ausschließen (abhängig u. a. von Wetter/Hafensituation) – ausgenommen Gäste, die Ein-/Ausstieg selbstständig beherrschen.",
    ]),
    sort_order: 29,
  },
  {
    title: "Trinkgelder",
    content: bullets([
      "Werden nicht automatisch berechnet – persönliches Trinkgeld kann an der Rezeption gegeben werden.",
    ]),
    sort_order: 30,
  },
  {
    title: "Verbotene Gegenstände",
    content: bullets([
      "Feuerwaffen, Munition, Pfefferspray (auch Tierabwehrspray) und andere Waffen sind nicht erlaubt.",
      "Drogen, Säuren, gefährliche Chemikalien, entflammbare Substanzen, eigene Funkgeräte, nicht konforme medizinische Geräte und sonstige Gefahrengüter (z. B. Bügeleisen, Heizgeräte, Kerzen) sind untersagt – ebenso Cannabis/ähnliche Rauschmittel, auch zum Eigengebrauch.",
      "Pflanzen mit Erde/Wurzeln, Pflanzenerzeugnisse, Sand und Muscheln sind wegen möglicher Insekten/Bakterien nicht erlaubt.",
      "Klapp- oder Jagdmesser sowie Messer mit mehr als 10 cm Klingenlänge sind nicht erlaubt.",
      "Drohnen dürfen für den privaten Gebrauch mitgebracht werden, Lagerung eigenverantwortlich auf der Kabine, Nutzung ausschließlich an Land.",
    ]),
    sort_order: 31,
  },
  {
    title: "Visum und Einreisepapiere",
    content: bullets([
      "Gäste sind selbst für gültige Ausweispapiere verantwortlich (siehe meinschiff.com/einreisebestimmungen); TUI Cruises hat keinen Einfluss auf die Kosten der Einreisepapiere.",
      "Bei als gestohlen/verloren gemeldeten, aber wiedergefundenen Ausweisdokumenten unbedingt einen (polizeilichen) Beleg über das Wiederfinden mitführen – sonst droht Einbehaltung/Konfiszierung bei erweiterten Einreisekontrollen.",
    ]),
    sort_order: 32,
  },
  {
    title: "Wäscherei und Reinigung",
    content: bullets(["Wäsche kann in der Bordwäscherei gereinigt werden – Wäschebeutel und Preisliste liegen auf der Kabine."]),
    sort_order: 33,
  },
  {
    title: "Zahlungsmittel",
    content: bullets([
      "Bezahlung an Bord bargeldlos in Euro über die Bordkarte – Kreditkarte (American Express, Visa, MasterCard) oder deutsche EC-Karte beim Online-Check-in hinterlegen; EC-Karten internationaler Banken und Diners-Club-Kreditkarten werden nicht akzeptiert, Barauszahlungen sind nicht möglich.",
      "In der letzten Nacht kommt die Endabrechnung automatisch an die Kabinentür (keine Unterschrift mehr nötig); auf Mein Schiff 3, 4, 7, Mein Schiff Relax und Mein Schiff Flow zusätzlich papierlos per E-Mail.",
      "Bordkonto wird bei Erreichen von 2.000 € automatisch belastet; eine Barzahlung der Bordabrechnung ist nicht möglich.",
    ]),
    sort_order: 34,
  },
];

// Notfalltelefon (medizinischer Notfall) und Notrufnummern (verspätete
// Ankunft am Anreisetag) sind je Schiff unterschiedlich - im Gegensatz zu
// sharedTips daher direkt pro Schiff hinterlegt.
const shipSpecific: Record<string, { notfalltelefon: string; notrufAnreise: string }> = {
  "Mein Schiff 1": { notfalltelefon: "+49 40 69 91 90 01", notrufAnreise: "+49 40 600 01-7101" },
  "Mein Schiff 2": { notfalltelefon: "+49 40 69 91 90 12", notrufAnreise: "+49 40 600 01-7102" },
  "Mein Schiff 3": { notfalltelefon: "+49 40 30 18 74 03", notrufAnreise: "+49 40 600 01-7103" },
  "Mein Schiff 4": { notfalltelefon: "+49 40 30 18 74 10", notrufAnreise: "+49 40 600 01-7104" },
  "Mein Schiff 5": { notfalltelefon: "+49 40 30 18 74 14", notrufAnreise: "+49 40 600 01-7105" },
  "Mein Schiff 6": { notfalltelefon: "+49 40 30 18 74 33", notrufAnreise: "+49 40 600 01-7106" },
  "Mein Schiff 7": { notfalltelefon: "+49 40 87 70 94 30", notrufAnreise: "+49 40 600 01-7107" },
  "Mein Schiff Relax": { notfalltelefon: "+49 40 87 40 80 28", notrufAnreise: "+49 40 600 01-7108" },
  "Mein Schiff Flow": { notfalltelefon: "+49 40 85 53 81 00", notrufAnreise: "+49 40 600 01-7109" },
};

function tipsForShip(shipName: string): Tip[] {
  const numbers = shipSpecific[shipName];
  return [
    ...sharedTips,
    {
      title: "Notfalltelefon und Notrufnummern",
      content: bullets([
        `Medizinischer Notfall an Bord: ${numbers.notfalltelefon}`,
        `Verspätete Ankunft am Anreisetag (Stau, Zugverspätung, Panne, Unfall, akute Krankheit): ${numbers.notrufAnreise} – nur am Tag der Anreise gültig, für andere Anliegen Reisebüro/TUI Cruises kontaktieren.`,
      ]),
      sort_order: 35,
    },
  ];
}

async function seedBordAbc() {
  for (const shipName of Object.keys(shipSpecific)) {
    for (const tip of tipsForShip(shipName)) {
      const { error: deleteError } = await supabase
        .from("ship_research")
        .delete()
        .eq("ship_name", shipName)
        .eq("category", "bord_abc")
        .eq("title", tip.title)
        .is("cabin_category", null);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from("ship_research").insert({
        ship_name: shipName,
        cabin_category: null,
        category: "bord_abc",
        title: tip.title,
        content: tip.content,
        source_tier: "A",
        source_name: SOURCE_NAME,
        source_url: null,
        staleness: "zeitlos",
        sort_order: tip.sort_order,
      });
      if (insertError) throw insertError;
      console.log(`ship_research: ${shipName} - ${tip.title}`);
    }
  }
}

async function main() {
  const ships = Object.keys(shipSpecific);
  const total = ships.length * (sharedTips.length + 1);
  await seedBordAbc();
  console.log(`Fertig: ${total} ship_research Zeilen (Kategorie bord_abc) für ${ships.length} Schiffe.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
