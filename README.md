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
2. Im SQL-Editor den Inhalt von `supabase/schema.sql` ausführen — legt alle sieben Tabellen an.
3. Unter *Project Settings → API* die `Project URL` und den `service_role`-Key kopieren (nicht den `anon`-Key — der Server-Code braucht vollen Schreibzugriff).

### 3. Anthropic API-Key besorgen

Auf [console.anthropic.com](https://console.anthropic.com) unter *API Keys* einen Key erzeugen.

### 4. Umgebungsvariablen setzen

```bash
cp .env.local.example .env.local
```

Dann `ANTHROPIC_API_KEY`, `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` eintragen.

### 5. Starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000), lade ein Foto einer Buchungsbestätigung hoch.

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

## Bekannte Lücken dieser ersten Version

- Kein Auth — für einen einzelnen Testnutzer bewusst weggelassen (siehe Konzeptdokument, offene Punkte).
- Upload-Größenlimit wird client- und serverseitig geprüft (Bilder 5 MB, PDFs 32 MB gemäß Claude-API-Limits) — bei Überschreitung erscheint eine klare Fehlermeldung statt eines kryptischen API-Fehlers. Auf der Hosting-Plattform können zusätzlich eigene Body-Size-Limits greifen, die unabhängig davon zu prüfen sind.
- HEIC-Fotos (iPhone-Standardformat) werden von Claude Vision nicht unterstützt — der Upload-Schritt akzeptiert nur JPG/PNG/WEBP/GIF und weist bei anderen Formaten mit einer klaren Fehlermeldung darauf hin, statt einen kryptischen API-Fehler durchzureichen.
