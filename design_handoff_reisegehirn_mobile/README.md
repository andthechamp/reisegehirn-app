# Handoff: Reisegehirn — Mobile App (iOS) + Web-Ansicht

## Overview
Neue Gestaltung für Reisegehirn (`andthechamp/reisegehirn-app`, branch `main`): sieben iOS-Screens
(Anmelden, Reiseseite, Tages-Navigation, Hafenrecherche, Schiff & Kabine, Ausflüge, Chat) plus zwei
Varianten für die Browser-Ansicht. Funktionsumfang und Datenmodell bleiben wie in der bestehenden
Next.js-App; neu sind die visuelle Richtung („analoges Logbuch“), eine Tab-Leiste am unteren Rand
(Reise · Tage · Ausflüge · Chat) und die direkte Kamera-Erfassung von Ausflugsbuchungen.

## About the Design Files
Die Datei in diesem Bundle ist eine **Designreferenz in HTML** — ein Prototyp, der Aussehen und
Verhalten zeigt, kein Produktionscode zum Kopieren. Aufgabe ist, diese Designs in der bestehenden
Umgebung des Projekts nachzubauen: Next.js 16 / React 19 mit Tailwind CSS 3, wie im Repo bereits
vorhanden. Die Tailwind-Theme-Farben in `tailwind.config.ts` (`ink`, `mist`, `fjord`, `amber`) und
die Display-Schrift (Fraunces) werden durch die unten stehenden Tokens **ersetzt** — das war die
ausdrückliche Vorgabe („fully new direction“). Die Geräterahmen (`ios-frame.jsx`,
`browser-window.jsx`) und `image-slot.js` sind nur Präsentationshilfen des Prototyps und gehören
**nicht** in die App.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände, Radien und Copy sind final gemeint und sollen
pixelgenau übernommen werden. Alle Werte stehen als Inline-Styles in der HTML-Datei und lassen sich
dort direkt ablesen.

## Design Tokens

Farben (in Tailwind als Theme-Farben anlegen):

| Token | Wert | Verwendung |
| --- | --- | --- |
| `paper` | `#F7F1E6` | Screen-Hintergrund |
| `paper-deep` | `#EFE7D8` | Seitenleisten, Chat-Spalte |
| `canvas` | `#EDE4D6` | Seitenhintergrund außerhalb der Spalte (Web) |
| `card` | `#FFFDF7` | Karten |
| `ink` | `#23201B` | Text |
| `ink/75, /65, /55, /45, /42, /12` | `rgba(35,32,27,…)` | Sekundärtext, Linien, Rahmen |
| `stamp` | `oklch(0.55 0.14 30)` | Primäraktion, aktiver Tag, aktiver Tab |
| `stamp-deep` | `oklch(0.5 0.14 30)` | Kategorie-Labels auf hellem Grund |
| `stamp-tint` | `oklch(0.96 0.02 30)` / `oklch(0.94 0.03 30)` | „Gemerkt“-Karten, Avatare |
| `sea` | `oklch(0.55 0.14 235)` | Zeiten, eigene Chat-Bubbles |
| `sea-tint` | `oklch(0.96 0.02 235)` / Rahmen `oklch(0.88 0.04 235)` | Kabinen-Karte |
| `excursion` | Fläche `oklch(0.96 0.03 75)`, Rahmen `oklch(0.85 0.05 75)`, Text `oklch(0.45 0.1 75)` | Ausflugskarten |
| Overlay auf Fotos | `linear-gradient(180deg, rgba(35,32,27,.45) 0%, rgba(35,32,27,.05) 45%, rgba(35,32,27,.8) 100%)` | Hero-Bilder |
| Text auf Foto | `#F7F1E6`, sekundär `rgba(247,241,230,.7)` | Hero |

Typografie (Google Fonts):

- **Instrument Serif**, 400 — Überschriften. 46/40/34/30/27/24/22/20 px, `line-height` 0.96–1.05.
- **Karla**, 400/500/600 — Fließtext und UI. Body 13,5–14 px / 1,5; Labels 11–13 px; Buttons 15,5–16,5 px / 600.
- **Courier Prime**, 400/700 — alle Daten und Metazeilen: Zeiten, Kabinennummern, Preise, Buchungsnummern,
  Quellenangaben, Tages- und Kategorie-Labels. Großbuchstaben mit `letter-spacing: .12em–.22em`,
  Größen 9,5–12,5 px.

Radien: 12 px (kleine Karten, Tagesspalten), 14 px (Karten, Eingaben, Buttons), 16–18 px (Tageskarte,
Chat-Bubbles), 22 px (Sheet oben), 999 px (Pills, Avatare).
Abstände: 20 px seitlicher Screen-Rand, 8/10/12 px zwischen Karten, 20–22 px zwischen Sektionen.
Schatten: sparsam — nur aktive Tagesspalte (`0 4px 12px rgba(35,32,27,.16)`) und Sheet
(`0 -12px 30px rgba(35,32,27,.12)`).

## Screens / Views

Referenz-IDs entsprechen den Badges in der HTML-Datei.

### 1a Anmelden (`/login`, `/signup`)
Vollflächiges Hochkant-Foto mit dunklem Verlauf, Inhalt unten ausgerichtet. Oben links Anker-Icon +
`REISEGEHIRN` (Courier Prime, 11 px, `letter-spacing:.22em`). Darüberliegend: Kicker „Logbuch Nr. 4“,
Titel „Willkommen an Bord“ (Instrument Serif 46/0.96). Zwei Eingabefelder als Glas-Karten
(`rgba(247,241,230,.1)`, Rahmen `rgba(247,241,230,.28)`, Radius 14, Label in Courier Prime 9,5 px über
dem Wert). Primärbutton „Einloggen“ (Fläche `stamp`, Höhe 52, Radius 14). Darunter „Noch kein Konto?
Registrieren“ und der Hinweis „Zugang nur für freigeschaltete Adressen“ (Allowlist aus
`supabase/schema.sql`). Fehlermeldungen wie bisher in `AuthForm.tsx`.

### 1b Reiseseite (`/trips/[id]`)
- **Hero, 318 px hoch**: Foto + Verlauf; oben `REISEGEHIRN` und Button „Bearbeiten“ (Pill, 1 px Rahmen
  `rgba(247,241,230,.5)`); unten Kicker „Norwegische Fjorde · 8 Tage“, Schiffsname (Instrument Serif 40),
  Datum/Start/Ende, danach die Reiseverlaufs-Balken aus `TripHero.tsx` (7 px hoch, 3 px Abstand,
  Hafentage `#F7F1E6`, Seetage `rgba(247,241,230,.3)`) und die Zeile „5 HÄFEN · 3 SEETAGE“.
- **Zwei Kurzkarten**: „Morgen“ (nächster Hafen + Liegezeit in `sea`) und „Kabine“ (Nummer + Typ/Deck).
- **Kabinen & Mitreisende**: Sektionstitel mit Unterlinie und Anzahl rechts; 2-spaltiges Grid aus
  `CabinCard`-Äquivalenten (Kabinennummer in Courier Prime 700/15, Typ 11,5 px, Initialen-Avatare 30 px).
- **Gemerkt**: Karten mit 3 px linker Kante in `stamp`, Radius `0 12px 12px 0`, Stern-Icon, Text 13,5/1,45.
- **Tab-Leiste**: Höhe 82 px, `rgba(247,241,230,.94)` + `backdrop-filter: blur(12px)`, Oberkante 1 px,
  vier Einträge (Icons 22 px aus `icons.tsx`: Anchor, Compass, Footprints, Chat), aktiv in `stamp`,
  inaktiv `rgba(35,32,27,.42)`, Label 10 px.

### 1c Tages-Navigation
Kopf „Reiseverlauf“ mit Schiffsname als Kicker. Waagerechter Tagesstreifen: Spalten 62 px breit,
je „TAG n“ (Courier Prime 9,5), Punkt 9 px (Hafentag `oklch(0.8 0.06 30)`, Seetag `rgba(35,32,27,.14)`),
Hafenname 11 px; aktive Spalte Fläche `stamp`, Text `#FDF8F0`. Darunter die Tageskarte (Radius 18,
Rahmen `ink/12`): Foto 150 px mit gedrehtem Stempel „TAG 03 · 16. JUNI“ (`rotate(-4deg)`, 1,5 px Rahmen
in `stamp`, Fläche `rgba(253,248,240,.86)`), Hafenname, Liegezeit „An 08:00 · Ab 17:30 · 9,5 h“,
Meta-Zeile Wetter/Anleger, Abschnitt „Gebuchte Ausflüge“ mit Ausflugskarte und gestricheltem
„+ Ausflug hinzufügen“. Vor/Zurück als 32-px-Kreise; Wischen links/rechts wie in `PortDaySwiper.tsx`
(Schwelle 40 px).

### 1d Hafenrecherche
Hero 200 px mit „‹ Tag 3“, Kicker „Hafenrecherche“, Hafenname, Zeile „10 Funde · geprüft 12.06.2026“.
Darunter ein Fund pro Karte in der festen Kategorie-Reihenfolge aus `PortResearch.tsx`
(anleger, sehenswuerdigkeiten, zu_fuss, ausflug_offiziell, ausflug_privat, essen, praktisches,
wetter_packen, insider_tipps, sonstiges). Jede Karte: Icon 16 px + Kategorie-Label (Courier Prime 700,
9,5 px, `letter-spacing:.16em`, uppercase), Titel 15/600, Text 13,5/1,55, Quellenzeile
„Quelle: … “ in Courier Prime 10,5 px `ink/45`. Listen-Funde als nummerierte Zeilen („01“, „02“ …).
Farbcodes: Anleger `sea`, Sehenswürdigkeiten `stamp`, neutrale Kategorien `ink/55`.

### 1e Schiff & Kabine
Kopf „Schiff & Kabine“ mit Kicker „Recherchiert · <Datum>“, Schiffsfoto 132 px (Radius 16).
Decksplan-Karte: Titel + Tabelle aus gepunkteten Zeilen (`border-bottom: 1px dotted rgba(35,32,27,.2)`,
Courier Prime 12) mit Deck-Nummer links und Nutzung rechts; die eigene Kabine ist als solche markiert.
Gästestimmen-Karte (Chat-Icon, `stamp`). Sektion „Deine Kabine“ mit Karte in `sea-tint`: Kategorie ·
Deck, Beschreibung, Quelle. Ohne manuellen „Erneut recherchieren“-Button — der bleibt Admins
vorbehalten (`/api/research/ship|cabin`).

### 1f Ausflüge
Kopf mit Kicker „4 gebucht · 512,00 EUR“. Karten je Ausflug, linke Kante 3 px:
Reederei = `stamp`, privat = `sea`, vergangen = `ink/20`. Kopfzeile „TAG 3 · GEIRANGER“ links und
Anbietertyp rechts (beides Courier Prime 10 px), Titel 15,5/600, dann Zeit · Treffpunkt · Preis ·
Buchungsnummer in Courier Prime 12/1,55.
Unten ein Sheet (Radius 22 oben, Grabber 38×4): „Buchung abfotografieren“ mit Erklärtext, zwei
Buttons („Kamera“ mit Kamera-Icon, gefüllt `stamp`; „PDF wählen“ als Umriss) und dem Limit-Hinweis
„JPG, PNG, WEBP oder PDF · max. 5 MB / 32 MB“ (aus `lib/document-upload.ts`; HEIC nicht unterstützt).

### 1g Chat
Kopfzeile mit Chat-Icon, „Reisegehirn fragen“, Unterzeile „Antworten aus Reisedaten & Recherche“.
Eigene Nachrichten rechts (`sea`, Text `#FDF8F0`, Radius `16 16 4 16`, max. 78 %), Antworten links
(`card`, Rahmen `ink/12`, Radius `16 16 16 4`, max. 84 %). Unter jeder Antwort die Aktion „Als wichtig
markieren“ (Stern) bzw. der Zustand „✓ Gemerkt — steht jetzt auf der Reiseseite“ in `stamp-deep`.
Eingabeleiste unten: Vorschlags-Pills, Textfeld (Radius 14, Höhe 46) und Sendebutton 46×46 in `stamp`.
Placeholder wie im Repo: „z. B. Wann legen wir in Geiranger an?“

### 2a Web — eine Spalte
Kopfleiste 52 px (`rgba(247,241,230,.9)`, Unterlinie `ink/12`) mit Logo links, Name und „Abmelden“
rechts. Inhalt: 672 px breite Spalte (entspricht `max-w-2xl`), zentriert auf `canvas`, mit 1 px
Seitenrändern; Hero 250 px, Tagesstreifen (Spalten 78 px), Tageskarte, Ausflugskarte. Ein Layout für
Handy und Desktop: unter 720 px fällt die Spalte auf volle Breite und die Tab-Leiste aus 1b erscheint.

### 2b Web — Desktop-Layout
Drei Zonen über die volle Höhe: links 214 px Tagesleiste (`paper-deep`, Liste mit „TAG n“ + Hafen,
aktiv als Fläche in `stamp`, darunter die Sekundärnavigation Schiff & Kabine / Ausflüge / Gemerkt /
Teilen); Mitte Hero 190 px mit gedrehtem Stempel und zweispaltigem Karten-Grid; rechts 296 px
Chat-Spalte, dauerhaft offen (statt Widget), mit eigener Eingabeleiste.

## Interactions & Behavior
- Tab-Leiste wechselt zwischen Reise / Tage / Ausflüge / Chat; aktiver Tab in `stamp`.
- Tagesstreifen: Tap auf Spalte oder Wischen (Schwelle 40 px) wechselt den Tag; Vor/Zurück am Rand
  deaktiviert (Opazität 30 %) am Anfang bzw. Ende.
- „Kamera“ öffnet die Kamera direkt (`<input type="file" accept="image/*" capture="environment">`),
  danach Extraktion über `/api/extract/excursion` und Zuordnung zum Hafentag; Fehlerzustände wie in
  `ExcursionForm.tsx` (Format, Größe, keine Erkennung).
- Chat: Senden per Enter, „Antwort wird erstellt …“ als Ladezustand, Stern-Aktion schreibt/löscht
  über `/api/memory`; markierte Antworten erscheinen auf der Reiseseite unter „Gemerkt“.
- Recherche läuft im Hintergrund (`ensureShipResearched` / `ensureCabinResearched` /
  `ensurePortResearched`). Fehlt ein Fund: Hinweistext, kein Button — außer für Admins.
- Übergänge kurz halten (150–200 ms, `ease-out`): Tageswechsel als Querblende, Sheet von unten.

## State Management
Unverändert gegenüber dem Repo: Trip-Kontext über `/api/trips/[id]` (`lib/trip-context.ts`), lokale
States für Ausflüge, Gemerkt, Chat-Nachrichten, sowie `activeIndex` für den Tag. Neu ist nur der
aktive Tab der Tab-Leiste (URL-gebunden, damit Zurück funktioniert) und der offene/geschlossene
Zustand des Kamera-Sheets.

## Assets
- Icons: bestehende Sammlung `src/components/icons.tsx` (Anchor, Layers, Chat, Compass, Footprints,
  Utensils, Info, Star, Cloud, Dot, Chevron, Close, Spinner) — unverändert weiterverwenden.
  Neu benötigt: ein Kamera-Icon (im Prototyp als 24er-Outline im gleichen Stil enthalten).
- Fotos im Prototyp: Wikimedia Commons (CC BY-SA), Motive Geiranger/Geirangerfjord. Nur Platzhalter —
  in der App kommen Bilder wie bisher über `lib/wikimedia.ts`; Attribution muss mitgeführt werden.
- Schriften: Instrument Serif, Karla, Courier Prime (Google Fonts, über `next/font/google` laden;
  Fraunces entfällt).

## Files
- `Reisegehirn Mobile.dc.html` — alle Screens (Badges 1a–1g, 2a–2b). Maßgebliche Quelle für alle Werte.
- `screenshots/` — 2x-Aufnahmen aller Screens: `01-anmelden`, `02-reiseseite`, `03-tage`,
  `04-hafenrecherche`, `05-schiff-kabine`, `06-ausfluege`, `07-chat`, `08-web-eine-spalte`,
  `09-web-desktop`. Die Fotoflächen erscheinen darin als schraffierte Platzhalter — die Bilder liegen
  nur extern (Wikimedia) und lassen sich nicht mit aufnehmen. Für die echten Motive die HTML-Datei
  im Browser öffnen.
- `ios-frame.jsx`, `browser-window.jsx`, `image-slot.js` — nur Präsentationsrahmen des Prototyps.
- `github.md` — Zuordnung Screen → Dateien im Repo (Screen map), Stand des Imports.
