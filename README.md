# Reisegehirn

Digitaler Begleiter für Kreuzfahrten: Buchungsunterlagen als Foto/PDF hochladen,
Claude extrahiert die Reisedaten (Schiff, Kabinen, Reiseverlauf, Mitreisende),
danach recherchiert die App bei Bedarf zu Schiff und Häfen, beantwortet Fragen
im Chat, verwaltet gebuchte Ausflüge und lässt sich mit Mitreisenden teilen.

## Funktionsumfang

- **Reise anlegen**: Foto/PDF der Buchungsbestätigung hochladen → Claude
  extrahiert Schiff, Route, Kabinen, Reiseverlauf (Tage/Häfen/Zeiten) und
  Mitreisende → Ergebnis wird vor dem Speichern geprüft und korrigiert.
  Liegezeiten werden dabei nie geraten, sondern bleiben leer, wenn sie im
  Dokument nicht eindeutig erkennbar sind.
- **Reise bearbeiten**: Alle extrahierten Felder lassen sich nachträglich
  anpassen (Kabinen/Mitreisende hinzufügen oder entfernen). Fehlen nur die
  Liegezeiten, lässt sich zusätzlich gezielt ein Reiseverlauf-Screenshot
  (z. B. aus der Reederei-App) hochladen — die erkannten Zeiten werden anhand
  von Datum/Hafenname automatisch den passenden Tagen zugeordnet, auch wenn
  an einem Tag mehrere Häfen angelaufen werden. Alternativ recherchiert
  `berth-time-research.ts` fehlende Liegezeiten selbst (Serper-Suche nach der
  Fahrplanseite der Reederei, Firecrawl zum Abrufen, Claude zum Auslesen).
- **Anreise/Abreise**: Transfers (Flug, Bahn, Parken, Taxi) lassen sich
  manuell erfassen oder per Foto/PDF auslesen (`ExtractedTransfer` in
  `src/lib/transfer-schema.ts`) und erscheinen sowohl im eigenen "Anreise"-Tab
  als auch am passenden Tag im Tage-Swiper.
- **Hafen-, Schiffs- und Routenrecherche**: Claude recherchiert per Websuche
  zu einem einzelnen Hafentag (Anlegestelle, Sehenswürdigkeiten, Ausflüge,
  Essen, Praktisches), zum Schiff selbst (Decksplan, Restaurants, Bord-ABC,
  Erfahrungsberichte anderer Gäste), zur gebuchten Kabinenkategorie und zu
  Routen-/Regionswissen (`route_research`, z. B. Karibik-Fahrplanbesonderheiten).
  Jeder Fund nennt seine Quelle und wird verifiziert, bevor er als Fakt
  behandelt wird. **Läuft standardmäßig nicht mehr automatisch** — der
  Hauptkostenblock (~25–35 ct pro Hafen, Sonnet + 6 Websuchen) wird bewusst
  redaktionell statt pro Reise neu gefüllt: fehlende Themen landen in
  `research_gaps` und erscheinen im Admin-Bereich, von wo sie per Klick auf
  "Jetzt recherchieren" oder per Seed-Skript (`scripts/seed-*.ts`) gefüllt
  werden. Der Schalter dafür ist `RESEARCH_AUTO` in
  `src/lib/research-config.ts` (aus by design, aber jederzeit reaktivierbar —
  Details dazu unten unter "KI-Nutzung"). Wetter (Open-Meteo, historischer
  Klimaschnitt bzw. echte Vorhersage kurz vor Reisebeginn) und Sehenswürdigkeiten-
  /Schiffsfotos (Wikimedia Commons/Wikipedia) laufen unabhängig davon weiter,
  weil sie ohne KI-Aufruf auskommen (`weather.ts`, `wikimedia.ts`,
  `ship-photos.ts`). Schiffsinfos lassen sich zusätzlich wöchentlich per Cron
  auffrischen (`vercel.json`, `/api/cron/refresh-ship-research`, standardmäßig
  ebenfalls hinter `RESEARCH_AUTO`).
- **Chat**: Fragen zur Reise beantwortet Claude (Haiku, ohne Websuche) auf
  Basis der gespeicherten Daten, der Recherche-Funde und bisheriger
  Chat-Antworten. Wichtige Antworten lassen sich als "Gemerkt" markieren und
  tauchen dann auf der Reiseseite auf.
- **Ausflüge**: Gebuchte Landausflüge lassen sich manuell erfassen oder per
  Foto/PDF auslesen (Anbieter, Treffpunkt, Zeit, Preis) und werden dem
  richtigen Hafentag zugeordnet.
- **Tages-Navigation & Route**: Häfen, Ausflüge und Transfers einer Reise
  lassen sich tageweise durchklicken/-swipen statt als eine lange Liste zu
  scrollen (`TabBar.tsx`: Reise/Tage/Ausflüge/Anreise/Chat). Eine Kartenansicht
  (`RouteMap.tsx`, MapLibre + OpenStreetMap-Tiles, kein API-Key nötig) zeigt
  die Route über alle Häfen.
- **Nutzerkonten, Rollen & Freigaben**: Login per E-Mail/Passwort, Reisen
  gehören einem Konto und lassen sich mit weiteren Konten teilen, Zugriff ist
  über Row-Level-Security in Postgres erzwungen (nicht nur im Code). Admins
  verwalten Rollen und die Registrierungs-Allowlist unter `/admin`
  (`InviteList.tsx`, `/api/admin/invites`) und sehen dort auch, welches
  Recherche-Wissen aktuell fehlt (`ResearchGapList.tsx`, reine Anzeige der
  `research_gaps`-Tabelle — nachgefüllt wird per Seed-Skript oder über den
  "Jetzt recherchieren"-Button auf der jeweiligen Reiseseite).

## Einrichtung

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) erstellen, **EU-Region** wählen (DSGVO).
2. Im SQL-Editor den Inhalt von `supabase/schema.sql` ausführen — legt alle Tabellen (Reisen, Kabinen, Mitreisende, Reiseverlauf, Ausflüge, Recherche-Funde, Chat, Nutzerprofile/Rollen, Freigaben) inkl. Row-Level-Security-Policies an.
3. Unter *Project Settings → API* sowohl den `service_role`-Key als auch den `anon`/`public`-Key kopieren (beide werden gebraucht, siehe Schritt 4).
4. Unter *Authentication → URL Configuration* die *Site URL* auf deine Domain setzen (lokal `http://localhost:3000`) — sonst zeigt der Bestätigungslink aus der Signup-E-Mail ins Leere.
5. Unter *Authentication → Providers → Email* prüfen, ob "Confirm email" aktiviert sein soll. Für schnelles lokales Testen kannst du es deaktivieren, dann ist ein Konto sofort nach dem Signup einsatzbereit.

### 3. Anthropic API-Key besorgen

Auf [console.anthropic.com](https://console.anthropic.com) unter *API Keys* einen Key erzeugen. Wird für Extraktion, Chat und die Websuche-Recherche gebraucht.

### 4. Umgebungsvariablen setzen

```bash
cp .env.local.example .env.local
```

Dann eintragen: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` (gleiche URL wie `SUPABASE_URL`) und
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Zusätzlich `CRON_SECRET` setzen (beliebiger geheimer String, z. B.
`openssl rand -hex 32`) — ohne dieses Secret lehnt
`/api/cron/refresh-ship-research` jeden Aufruf ab (fail-closed), statt
öffentlich erreichbar zu sein. Auf Vercel als Environment Variable eintragen;
Vercel schickt ihn bei geplanten Cron-Aufrufen automatisch als Bearer-Token mit.

Für die automatische Liegezeiten-Recherche (`berth-time-research.ts`)
zusätzlich `SERPER_API_KEY` ([serper.dev](https://serper.dev), gezielte
Google-Suche nach der Fahrplanseite der Reederei) und `FIRECRAWL_API_KEY`
([firecrawl.dev](https://firecrawl.dev), zuverlässiges Abrufen der
gefundenen Seite inkl. JS-Rendering/Anti-Bot) eintragen. Beide sind optional,
solange dieses Feature nicht genutzt wird.

### 5. Starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) — du landest zuerst auf `/signup`, weil die ganze App einen Login verlangt.

### 6. Registrierung freischalten & ersten Admin setzen

Reisegehirn ist für einen geschlossenen Nutzerkreis gedacht — die Registrierung
unter `/signup` ist per Allowlist gesperrt (Prüfung sitzt als Datenbank-Trigger
auf `auth.users`, siehe `supabase/schema.sql`, Abschnitt "SIGNUP-ALLOWLIST").
Vor der allerersten Registrierung einmalig im Supabase SQL-Editor die eigene
E-Mail freischalten:

```sql
insert into public.allowed_signup_emails (email) values ('deine@mail.de');
```

Nach der Registrierung im selben SQL-Editor die eigene Rolle auf Admin setzen:

```sql
update public.profiles set role = 'admin' where email = 'deine@mail.de';
```

Danach erscheint im Header ein "Admin"-Link zu `/admin`, wo weitere Konten zu
Admins gemacht **und weitere E-Mail-Adressen zur Registrierung freigeschaltet**
werden können — ohne erneut den SQL-Editor zu brauchen.

## Projektstruktur

```
src/
  app/
    page.tsx                        Reise anlegen (Hochladen -> Prüfen -> Fertig) + Übersicht eigener Reisen (TripList.tsx)
    trips/[id]/page.tsx             Reiseseite: Tabs Reise/Tage/Ausflüge/Anreise/Chat (TabBar.tsx) + Bord-ABC
    trips/[id]/edit/page.tsx        Reise bearbeiten (ReviewStep im "edit"-Modus)
    admin/page.tsx                  Nutzerverwaltung, Registrierungs-Allowlist, offene Recherche-Lücken (nur Admins)
    account/page.tsx                Eigenes Profil (Anzeigename)
    login/, signup/, auth/callback/ Auth-Flow
    api/
      extract/route.ts              Foto/PDF -> vollständige Reise-Extraktion
      extract/excursion/route.ts    Foto/PDF -> ein Ausflug
      extract/itinerary/route.ts    Foto/PDF -> nur Reiseverlauf (Tage/Zeiten), fürs Nachbearbeiten
      confirm/route.ts              Bestätigte Extraktion -> Supabase (neue Reise)
      trips/route.ts, trips/[id]/route.ts   Reisen auflisten / lesen / aktualisieren
      trips/[id]/share/route.ts     Reise mit weiterem Konto teilen
      transfers/, transfers/[id]/   Anreise-/Abreise-Transfers anlegen/entfernen
      research/ship|port|cabin/route.ts     Recherche manuell auslösen (Admin, kostenpflichtig)
      research/[id]/, research/ship/[id]/, research/port/[id]/   Einzelnen Fund entfernen
      excursions/, excursions/[id]/ Ausflüge anlegen/entfernen
      memory/, memory/[id]/         "Gemerkt"-Einträge anlegen/entfernen
      chat/route.ts                 Chat-Antworten (ohne Websuche)
      cron/refresh-ship-research/   Wöchentlicher Schiffsrecherche-Refresh (hinter RESEARCH_AUTO)
      admin/users/route.ts          Rollen verwalten
      admin/invites/route.ts        Registrierungs-Allowlist verwalten
      profile/route.ts              Anzeigename ändern
  components/
    UploadStep.tsx, ReviewStep.tsx, SuccessStep.tsx   Die Bestätigungsschleife bei Anlegen/Bearbeiten
    TripHero.tsx, PortDaySwiper.tsx, CabinCard.tsx, TabBar.tsx, RouteMap.tsx   Reiseseite
    ShipResearch.tsx, PortResearch.tsx, CabinResearch.tsx, RouteResearch.tsx,
    ResearchCard.tsx, FindingContent.tsx, BordAbc.tsx   Recherche-Anzeige
    TransferCard.tsx, TransferForm.tsx                Anreise/Abreise
    ExcursionForm.tsx, ExcursionCard.tsx              Ausflüge
    MemoryItem.tsx, ChatPanel.tsx                     Gemerkt & Chat
    ShareTrip.tsx, UserTable.tsx, InviteList.tsx,
    ResearchGapList.tsx, ProfileForm.tsx              Freigaben, Admin, Profil
    AuthForm.tsx, LogoutButton.tsx, SiteHeader.tsx,
    CloseButton.tsx, Spinner.tsx, icons.tsx, MarkdownText.tsx   Gemeinsame Bausteine
  lib/
    prompts.ts                      Alle System-Prompts (Extraktion, Chat, Hafen-/Schiffs-/Liegezeiten-Recherche)
    extraction-schema.ts            Typen für die volle Reise-Extraktion
    excursion-schema.ts             Typen für die Ausflugs-Extraktion
    itinerary-schema.ts             Typen für die Reiseverlauf-Nachbearbeitung
    transfer-schema.ts              Typen für die Transfer-Extraktion
    research-schema.ts              Typen + toleranter JSON-Parser für Recherche-Funde
    research-config.ts              RESEARCH_ENABLED/RESEARCH_AUTO-Schalter (siehe "KI-Nutzung" unten)
    research-gaps.ts                Verwaltung der research_gaps-Tabelle (offene Themen, Versuchsobergrenze)
    ship-research.ts, port-research.ts, route-research.ts   Recherche-Logik je Bereich (von Routes und Cron genutzt)
    berth-time-research.ts          Liegezeiten-Recherche per Serper+Firecrawl+Claude
    cabin.ts                        Kabinenkategorie normalisieren (Cache-Schlüssel für ship_research)
    port-names.ts, port-coordinates.ts   Kuratierte Hafennamen-Normalisierung, Geocoding-Cache
    ship-photos.ts, wikimedia.ts    Schiffs-/Sehenswürdigkeiten-Fotos von Wikimedia Commons (kein KI-Aufruf)
    weather.ts                      Wetter von Open-Meteo (klimatologischer Schnitt bzw. echte Vorhersage, kein KI-Aufruf)
    trip-context.ts                 Lädt eine Reise inkl. aller Ebenen für Seite/Chat
    document-upload.ts              Datei-Validierung (Größe/Typ) für alle Upload-Endpunkte
    anthropic.ts, supabase.ts, supabase-browser.ts
    format-list.ts, format-time.ts  Kleine Text-/Eingabe-Formatierungshelfer
scripts/
  seed-*.ts                         Redaktionelle Recherche-Skripte (Bord-ABC, Häfen nach Region, Fleet-Dossiers, ...)
  scan-research-gaps.ts             Füllt research_gaps aus dem Ist-Bestand
  backfill-*.ts, dedupe-*.ts, revalidate-*.ts   Einmalige Datenpflege-Skripte
supabase/
  schema.sql                        Alle Tabellen inkl. Row-Level-Security-Policies
vercel.json                         Cron-Konfiguration für den Schiffsrecherche-Refresh
```

## KI-Nutzung

Die Anthropic-Nutzung ist bewusst aufs Minimum reduziert: Dokumenten-
Extraktion (Sonnet, 4 Endpunkte: Reise, Ausflug, Reiseverlauf, Transfer) und
Chat ohne Websuche (Haiku). Die Websuche-Recherche für Schiff/Kabine/Hafen/
Route läuft standardmäßig **nicht** automatisch beim Hochladen oder Laden
einer Reise — ihre Inhalte sind Weltwissen, das für alle Nutzer:innen
identisch ist, also einmal redaktionell (Seed-Skripte in `scripts/`) statt
pro Reise neu recherchiert wird. Fehlende Themen landen stattdessen in
`research_gaps` und lassen sich im Admin-Bereich gezielt per Klick oder
Skript nachfüllen.

- `RESEARCH_ENABLED` (`src/lib/research-config.ts`): Hauptschalter, schaltet
  die komplette Websuche-Recherche ab — auch für Admins.
- `RESEARCH_AUTO` (dieselbe Datei, Default `false`): schaltet nur die
  *automatische* Recherche beim Hochladen/Laden einer Reise um. Auf `true`
  gesetzt lebt die alte Automatik wieder auf, begrenzt durch
  `MAX_AUTO_ATTEMPTS` aus `src/lib/research-gaps.ts`, damit ein Thema, das
  die Websuche partout nicht liefert, nicht bei jedem Seitenaufruf einen
  neuen Sonnet-Lauf auslöst.

Kostenlose Anreicherung (Wetter, Wikimedia-Fotos, Geocoding) läuft von
beiden Schaltern unberührt weiter, weil sie ohne Anthropic-Aufruf auskommt.

## Nutzerkonten, Rollen & Freigaben

- Login/Registrierung läuft über Supabase Auth (E-Mail/Passwort). `src/proxy.ts` verlangt für alle Routen außer `/login`, `/signup` und `/auth/callback` eine gültige Session.
- Jede Reise gehört einem Konto (`trips.owner_id`). Der Besitzer kann sie über den "Reise teilen"-Abschnitt auf der Reiseseite mit weiteren Konten (per E-Mail) teilen; geteilte Konten sehen und bearbeiten die Reise vollständig, können sie aber nicht löschen oder weitere Konten hinzufügen.
- Zugriff wird über Postgres Row-Level-Security erzwungen (`supabase/schema.sql`), nicht nur im Anwendungscode — selbst ein Bug in einer Route kann fremde Reisen nicht offenlegen.
- Rollen (`user`/`admin`) liegen in `public.profiles`. Admins sehen `/admin` und können dort Rollen anderer Konten umschalten.

## Bekannte Grenzen

- Upload-Größenlimit wird client- und serverseitig geprüft (Bilder 5 MB, PDFs 32 MB gemäß Claude-API-Limits) — bei Überschreitung erscheint eine klare Fehlermeldung statt eines kryptischen API-Fehlers. Auf der Hosting-Plattform können zusätzlich eigene Body-Size-Limits greifen, die unabhängig davon zu prüfen sind.
- HEIC-Fotos (iPhone-Standardformat) werden von Claude Vision nicht unterstützt — der Upload-Schritt akzeptiert nur JPG/PNG/WEBP/GIF/PDF und weist bei anderen Formaten mit einer klaren Fehlermeldung darauf hin.
- Recherche-Ergebnisse hängen von der Websuche ab und können bei sehr neuen/seltenen Häfen dünn ausfallen oder ganz leer bleiben — die App zeigt das dann als "keine verlässlichen Informationen gefunden" statt zu raten.
