# Reisegehirn — erste Scheibe

Dies ist die kleinste funktionierende Version aus dem MVP-Plan: **Foto hochladen → Claude extrahiert die Reisedaten → du prüfst und korrigierst → Speichern in der Datenbank.**

Kein Chat, keine Recherche, kein WhatsApp — bewusst, siehe Konzeptdokument Abschnitt 9 (MVP-Abgrenzung).

## Warum du das selbst installieren musst

Der Code wurde in einer Umgebung ohne Internetzugang geschrieben und konnte
deshalb nicht installiert oder getestet werden. Das ist der Moment, an dem
Claude Code auf deinem eigenen Rechner sinnvoll übernimmt — dort hast du
vollen Netzzugang und kannst iterieren, während du zusiehst.

## Einrichtung

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) erstellen, **EU-Region** wählen (siehe Konzeptdokument, DSGVO).
2. Im SQL-Editor den Inhalt von `supabase/schema.sql` ausführen — legt alle Tabellen inkl. Nutzerkonten/Rollen/Freigaben und die zugehörigen Row-Level-Security-Policies an.
3. Unter *Project Settings → API* sowohl den `service_role`-Key als auch den `anon`/`public`-Key kopieren (beide werden jetzt gebraucht, siehe Schritt 4).
4. Unter *Authentication → URL Configuration* die *Site URL* auf deine Domain setzen (lokal `http://localhost:3000`) — sonst zeigt der Bestätigungslink aus der Signup-E-Mail ins Leere.
5. Unter *Authentication → Providers → Email* prüfen, ob "Confirm email" aktiviert sein soll. Für schnelles lokales Testen kannst du es deaktivieren, dann ist ein Konto sofort nach dem Signup einsatzbereit.

### 3. Anthropic API-Key besorgen

Auf [console.anthropic.com](https://console.anthropic.com) unter *API Keys* einen Key erzeugen.

### 4. Umgebungsvariablen setzen

```bash
cp .env.local.example .env.local
```

Dann `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` (gleiche URL wie `SUPABASE_URL`) und
`NEXT_PUBLIC_SUPABASE_ANON_KEY` eintragen.

### 5. Starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) — du landest zuerst auf `/signup`, weil die ganze App jetzt einen Login verlangt.

### 6. Ersten Admin freischalten

Registrierung schaltet standardmäßig ein normales Konto ohne Admin-Rechte frei.
Nach der ersten Registrierung einmalig im Supabase SQL-Editor:

```sql
update public.profiles set role = 'admin' where email = 'deine@mail.de';
```

Danach erscheint im Header ein "Admin"-Link zu `/admin`, wo weitere Konten zu Admins gemacht werden können.

## Ersten Test machen

Am besten eignet sich dafür ein Screenshot des Reiseverlaufs, wie wir ihn im
Konzeptdokument als Beispiel verwendet haben (Ankunfts-/Abfahrtszeiten pro
Hafen). Prüfe danach besonders:

- Wurden Liegezeiten übernommen, **ohne** dass irgendwo eine plausibel
  klingende Uhrzeit erfunden wurde? (Regel aus Konzeptdokument 3.2)
- Landen unsichere Stellen in den Hinweisen statt einfach zu fehlen?
- Stimmt die `confidence`-Spalte in `port_calls` nach dem Speichern —
  `bestätigt` nur dort, wo beide Zeiten vorhanden sind?

Die 30 Benchmark-Fragen (`reisegehirn_benchmark_fragen.md`) lassen sich mit
dieser ersten Scheibe noch nicht beantworten — dafür fehlt der Chat-Teil.
Das ist der nächste Baustein, sobald diese Grundmechanik zuverlässig läuft.

## Projektstruktur

```
src/
  app/
    page.tsx              Orchestriert die drei Schritte
    api/extract/route.ts  Foto -> Claude Vision -> strukturierte Daten
    api/confirm/route.ts  Bestätigte Daten -> Supabase
  components/
    UploadStep.tsx
    ReviewStep.tsx         Die Bestätigungsschleife aus Abschnitt 3.1
    SuccessStep.tsx
  lib/
    prompts.ts             Der Extraktions-Prompt mit allen Regeln
    extraction-schema.ts   Typen, passend zu supabase/schema.sql
    anthropic.ts
    supabase.ts
supabase/
  schema.sql               Identisch zur separat gelieferten Datei
```

## Nutzerkonten, Rollen & Freigaben

- Login/Registrierung läuft über Supabase Auth (E-Mail/Passwort). `middleware.ts` verlangt für alle Routen außer `/login`, `/signup` und `/auth/callback` eine gültige Session.
- Jede Reise gehört einem Konto (`trips.owner_id`). Der Besitzer kann sie über den "Reise teilen"-Abschnitt auf der Reiseseite mit weiteren Konten (per E-Mail) teilen; geteilte Konten sehen und bearbeiten die Reise vollständig, können sie aber nicht löschen oder weitere Konten hinzufügen.
- Zugriff wird über Postgres Row-Level-Security erzwungen (`supabase/schema.sql`), nicht nur im Anwendungscode — selbst ein Bug in einer Route kann fremde Reisen nicht offenlegen.
- Rollen (`user`/`admin`) liegen in `public.profiles`. Admins sehen `/admin` und können dort Rollen anderer Konten umschalten.

## Bekannte Lücken dieser ersten Version

- Upload-Größenlimit wird client- und serverseitig geprüft (Bilder 5 MB, PDFs 32 MB gemäß Claude-API-Limits) — bei Überschreitung erscheint eine klare Fehlermeldung statt eines kryptischen API-Fehlers. Auf der Hosting-Plattform können zusätzlich eigene Body-Size-Limits greifen, die unabhängig davon zu prüfen sind.
- HEIC-Fotos (iPhone-Standardformat) werden von Claude Vision nicht unterstützt — der Upload-Schritt akzeptiert nur JPG/PNG/WEBP/GIF und weist bei anderen Formaten mit einer klaren Fehlermeldung darauf hin, statt einen kryptischen API-Fehler durchzureichen.
