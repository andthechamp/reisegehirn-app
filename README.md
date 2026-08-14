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
  an einem Tag mehrere Häfen angelaufen werden.
- **Hafen- und Schiffsrecherche**: Auf Knopfdruck recherchiert Claude per
  Websuche zu einem einzelnen Hafentag (Anlegestelle, Sehenswürdigkeiten,
  Ausflüge, Essen, Praktisches, Wetter) oder zum Schiff selbst (Decksplan,
  Restaurants, Ausstattung, Erfahrungsberichte anderer Gäste). Jeder Fund
  nennt seine Quelle und wird verifiziert, bevor er als Fakt behandelt wird.
  Schiffsrecherche wird zusätzlich wöchentlich per Cron aufgefrischt
  (`vercel.json`, `/api/cron/refresh-ship-research`).
- **Chat**: Fragen zur Reise beantwortet Claude auf Basis der gespeicherten
  Daten, der Recherche-Funde und bisheriger Chat-Antworten. Wichtige
  Antworten lassen sich als "Gemerkt" markieren und tauchen dann auf der
  Reiseseite auf.
- **Ausflüge**: Gebuchte Landausflüge lassen sich manuell erfassen oder per
  Foto/PDF auslesen (Anbieter, Treffpunkt, Zeit, Preis) und werden dem
  richtigen Hafentag zugeordnet.
- **Tages-Navigation**: Häfen und Ausflüge einer Reise lassen sich tageweise
  durchklicken/-swipen statt als eine lange Liste zu scrollen.
- **Nutzerkonten, Rollen & Freigaben**: Login per E-Mail/Passwort, Reisen
  gehören einem Konto und lassen sich mit weiteren Konten teilen, Zugriff ist
  über Row-Level-Security in Postgres erzwungen (nicht nur im Code). Admins
  verwalten Rollen unter `/admin`.

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

Für den wöchentlichen Schiffsrecherche-Cron zusätzlich `CRON_SECRET` setzen
(beliebiger geheimer String) — nötig, damit `/api/cron/refresh-ship-research`
nicht von außen aufrufbar ist. Auf Vercel als Environment Variable eintragen;
Vercel schickt ihn bei geplanten Cron-Aufrufen automatisch als Bearer-Token mit.

### 5. Starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) — du landest zuerst auf `/signup`, weil die ganze App einen Login verlangt.

### 6. Ersten Admin freischalten

Registrierung schaltet standardmäßig ein normales Konto ohne Admin-Rechte frei.
Nach der ersten Registrierung einmalig im Supabase SQL-Editor:

```sql
update public.profiles set role = 'admin' where email = 'deine@mail.de';
```

Danach erscheint im Header ein "Admin"-Link zu `/admin`, wo weitere Konten zu Admins gemacht werden können.

## Projektstruktur

```
src/
  app/
    page.tsx                        Reise anlegen (Hochladen -> Prüfen -> Fertig) + Übersicht eigener Reisen
    trips/[id]/page.tsx             Reiseseite: Hero, Kabinen, Schiffsrecherche, Häfen/Ausflüge, Gemerkt, Chat, Teilen
    trips/[id]/edit/page.tsx        Reise bearbeiten (ReviewStep im "edit"-Modus)
    admin/page.tsx                  Nutzerverwaltung (nur Admins)
    account/page.tsx                Eigenes Profil (Anzeigename)
    login/, signup/                 Auth-Flow
    api/
      extract/route.ts              Foto/PDF -> vollständige Reise-Extraktion
      extract/excursion/route.ts    Foto/PDF -> ein Ausflug
      extract/itinerary/route.ts    Foto/PDF -> nur Reiseverlauf (Tage/Zeiten), fürs Nachbearbeiten
      confirm/route.ts              Bestätigte Extraktion -> Supabase (neue Reise)
      trips/[id]/route.ts           Reise lesen/aktualisieren
      trips/[id]/share/route.ts     Reise mit weiterem Konto teilen
      research/port/route.ts        Hafenrecherche (Websuche)
      research/ship/route.ts        Schiffsrecherche (Websuche)
      research/[id]/, research/ship/[id]/   Einzelnen Fund entfernen
      excursions/, excursions/[id]/ Ausflüge anlegen/entfernen
      memory/, memory/[id]/         "Gemerkt"-Einträge anlegen/entfernen
      chat/route.ts                 Chat-Antworten
      cron/refresh-ship-research/   Wöchentlicher Schiffsrecherche-Refresh
      admin/users/route.ts          Rollen verwalten
      profile/route.ts              Anzeigename ändern
  components/
    UploadStep.tsx, ReviewStep.tsx, SuccessStep.tsx   Die Bestätigungsschleife bei Anlegen/Bearbeiten
    TripHero.tsx, PortDaySwiper.tsx, CabinCard.tsx    Reiseseite
    ShipResearch.tsx, PortResearch.tsx, ResearchCard.tsx, FindingContent.tsx   Recherche-Anzeige
    ExcursionForm.tsx, ExcursionCard.tsx              Ausflüge
    MemoryItem.tsx, ChatWidget.tsx, ChatPanel.tsx      Gemerkt & Chat
    ShareTrip.tsx, UserTable.tsx, ProfileForm.tsx      Freigaben, Admin, Profil
    AuthForm.tsx, SiteHeader.tsx, Spinner.tsx, icons.tsx, MarkdownText.tsx   Gemeinsame Bausteine
  lib/
    prompts.ts                      Alle System-Prompts (Extraktion, Chat, Hafen-/Schiffsrecherche)
    extraction-schema.ts            Typen für die volle Reise-Extraktion
    excursion-schema.ts             Typen für die Ausflugs-Extraktion
    itinerary-schema.ts             Typen für die Reiseverlauf-Nachbearbeitung
    research-schema.ts              Typen + toleranter JSON-Parser für Recherche-Funde
    ship-research.ts                Schiffsrecherche-Logik (von Route und Cron genutzt)
    trip-context.ts                 Lädt eine Reise inkl. aller Ebenen für Seite/Chat
    document-upload.ts              Datei-Validierung (Größe/Typ) für alle Upload-Endpunkte
    anthropic.ts, supabase.ts, supabase-browser.ts
    format-list.ts, format-time.ts  Kleine Text-/Eingabe-Formatierungshelfer
supabase/
  schema.sql                        Alle Tabellen inkl. Row-Level-Security-Policies
vercel.json                         Cron-Konfiguration für den Schiffsrecherche-Refresh
```

## Nutzerkonten, Rollen & Freigaben

- Login/Registrierung läuft über Supabase Auth (E-Mail/Passwort). `src/proxy.ts` verlangt für alle Routen außer `/login`, `/signup` und `/auth/callback` eine gültige Session.
- Jede Reise gehört einem Konto (`trips.owner_id`). Der Besitzer kann sie über den "Reise teilen"-Abschnitt auf der Reiseseite mit weiteren Konten (per E-Mail) teilen; geteilte Konten sehen und bearbeiten die Reise vollständig, können sie aber nicht löschen oder weitere Konten hinzufügen.
- Zugriff wird über Postgres Row-Level-Security erzwungen (`supabase/schema.sql`), nicht nur im Anwendungscode — selbst ein Bug in einer Route kann fremde Reisen nicht offenlegen.
- Rollen (`user`/`admin`) liegen in `public.profiles`. Admins sehen `/admin` und können dort Rollen anderer Konten umschalten.

## Bekannte Grenzen

- Upload-Größenlimit wird client- und serverseitig geprüft (Bilder 5 MB, PDFs 32 MB gemäß Claude-API-Limits) — bei Überschreitung erscheint eine klare Fehlermeldung statt eines kryptischen API-Fehlers. Auf der Hosting-Plattform können zusätzlich eigene Body-Size-Limits greifen, die unabhängig davon zu prüfen sind.
- HEIC-Fotos (iPhone-Standardformat) werden von Claude Vision nicht unterstützt — der Upload-Schritt akzeptiert nur JPG/PNG/WEBP/GIF/PDF und weist bei anderen Formaten mit einer klaren Fehlermeldung darauf hin.
- Recherche-Ergebnisse hängen von der Websuche ab und können bei sehr neuen/seltenen Häfen dünn ausfallen oder ganz leer bleiben — die App zeigt das dann als "keine verlässlichen Informationen gefunden" statt zu raten.
