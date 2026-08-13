-- ============================================================
-- REISEGEHIRN — Datenmodell v1
-- Postgres / Supabase-kompatibel
--
-- Abbildung der drei Speicherebenen aus dem Konzeptdokument:
--   Ebene 1 "Harte Fakten"        -> trips, travelers, bookings, port_calls
--   Ebene 2 "Recherchiertes Wissen" -> research_findings
--   Ebene 3 "Nutzergedächtnis"    -> user_memory
--   (plus messages für den Chatverlauf)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- EBENE 1: HARTE FAKTEN
-- Verbindlich. Schlägt im Zweifel jede andere Ebene.
-- ------------------------------------------------------------

create table trips (
  id            uuid primary key default gen_random_uuid(),
  ship_name     text not null,                 -- z. B. "Mein Schiff 1"
  route_name    text,                           -- z. B. "Norwegens Fjordwelten"
  start_date    date not null,
  end_date      date not null,
  start_port    text,
  end_port      text,
  status        text not null default 'geplant'
                  check (status in ('geplant', 'bestätigt', 'abgeschlossen')),
  created_at    timestamptz not null default now()
);

-- Eine Reise kann mehrere Kabinen/Buchungen umfassen (Familien-/Gruppenreisen) -
-- daher eine Zeile pro Kabine statt einer einzelnen Buchung pro Reise.
create table bookings (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id) on delete cascade,
  cabin_number        text,
  cabin_type          text,
  price_total         numeric(10,2),
  currency            text default 'EUR',
  tariff              text,                     -- z. B. "PRO"
  booking_reference   text,
  source_document_ref text,                     -- Verweis auf das hochgeladene Foto/PDF (Audit-Trail)
  extracted_at        timestamptz,
  confirmed_by_user   boolean not null default false,  -- Bestätigungsschleife aus 3.1
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create table travelers (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references trips(id) on delete cascade,
  booking_id      uuid references bookings(id) on delete set null,  -- welcher Kabine der Reisende zugeordnet ist
  name            text not null,
  age_at_trip     int,                          -- Alter zum Reisezeitpunkt, für Altersgrenzen-Abgleich
  is_primary_booker boolean not null default false,
  created_at      timestamptz not null default now()
);

create table port_calls (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references trips(id) on delete cascade,
  day_number      int not null,
  call_date       date not null,
  port_name       text not null,
  arrival_time    time,                         -- NULL = unbekannt, siehe confidence
  departure_time  time,
  is_sea_day      boolean not null default false,
  confidence      text not null default 'erschlossen'
                    check (confidence in ('bestätigt', 'erschlossen', 'unbekannt')),
  -- 'bestätigt'  = aus Buchungsunterlagen / Reiseverlauf
  -- 'erschlossen' = aus Recherche abgeleitet, nicht verifiziert
  -- 'unbekannt'   = Pflichtfeld fehlt, System darf keine zeitbezogene Empfehlung geben (Regel 3.2)
  source          text,                         -- z. B. "Screenshot Reiseverlauf", "TUI Website"
  created_at      timestamptz not null default now()
);

-- Vom Nutzer tatsächlich gebuchte Landausflüge, pro Hafenanlauf. Bewusst
-- getrennt von research_findings: das hier sind bestätigte harte Fakten
-- (Ebene 1), keine recherchierten, unsicheren Möglichkeiten (Ebene 2).
create table port_excursions (
  id                uuid primary key default gen_random_uuid(),
  port_call_id      uuid not null references port_calls(id) on delete cascade,
  trip_id           uuid not null references trips(id) on delete cascade,
  title             text not null,
  provider_type     text not null default 'privat'
                      check (provider_type in ('reederei', 'privat')),
  meeting_point     text,
  meeting_time      time,
  price_total       numeric(10,2),
  currency          text default 'EUR',
  booking_reference text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- EBENE 2: RECHERCHIERTES WISSEN
-- Hilfreich, aber als Fundstück gekennzeichnet.
-- ------------------------------------------------------------

create table research_findings (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id) on delete cascade,
  port_call_id        uuid references port_calls(id) on delete cascade,
  -- NULL = reiseübergreifend (Schiffswissen, Packtipps, Wetter allgemein)
  -- gesetzt = hafenspezifisch

  category            text not null
                        check (category in (
                          'anleger', 'ausflug_offiziell', 'ausflug_privat',
                          'zu_fuss', 'essen', 'praktisches', 'sehenswuerdigkeiten',
                          'schiffswissen', 'insider_tipps', 'wetter_packen', 'sonstiges'
                        )),
  title               text not null,
  content             text not null,

  source_tier         text not null check (source_tier in ('A', 'B', 'C')),
  -- A = offiziell (Reederei, Hafenbehörde)  B = etabliertes Portal  C = Forum/Blog
  source_name         text,
  source_url          text,

  staleness           text not null default 'saisonal'
                        check (staleness in ('zeitlos', 'saisonal', 'verfällt')),
  -- zeitlos  = z. B. Packtipps, bleibt gültig
  -- saisonal = z. B. Wetter, jährlich neu prüfen
  -- verfällt = z. B. Preise, schnell veraltet

  min_age_requirement int,                      -- für Abgleich gegen travelers.age_at_trip
  flagged_conflict    boolean not null default false,  -- Widerspruch zu anderer Quelle erkannt
  superseded_by        uuid references research_findings(id),  -- zeigt auf aktuellere Version

  sort_order          int not null default 0,  -- Anzeigereihenfolge innerhalb eines Recherche-Laufs
  retrieved_at        timestamptz not null default now()
);

-- Schiffsinfos (Decksplan, Restaurants, Gästestimmen) sind NICHT reisespezifisch,
-- sondern gehören zum Schiff selbst - deshalb eigene Tabelle, geschlüsselt über
-- ship_name statt trip_id. Zwei Reisen auf demselben Schiff teilen sich so die
-- bereits recherchierten Daten, statt für jede Reise erneut Claude/Websuche zu
-- bemühen. "Erneut recherchieren" in der UI überschreibt den Cache bewusst neu.
create table ship_research (
  id           uuid primary key default gen_random_uuid(),
  ship_name    text not null,
  category     text not null check (category in ('schiffswissen', 'insider_tipps')),
  title        text not null,
  content      text not null,
  source_tier  text not null check (source_tier in ('A', 'B', 'C')),
  source_name  text,
  source_url   text,
  staleness    text not null default 'saisonal'
                 check (staleness in ('zeitlos', 'saisonal', 'verfällt')),
  sort_order   int not null default 0,
  retrieved_at timestamptz not null default now()
);

create index idx_ship_research_name on ship_research(ship_name);

-- ------------------------------------------------------------
-- EBENE 3: NUTZERGEDÄCHTNIS
-- Wächst über die Zeit, überschreibt Vorschläge.
-- ------------------------------------------------------------

create table user_memory (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id) on delete cascade,
  content             text not null,
  source_type         text not null default 'manual_note'
                        check (source_type in ('marked_answer', 'manual_note', 'decision')),
  source_research_id  uuid references research_findings(id),
  -- gesetzt, wenn die Notiz aus einem "als wichtig markiert"-Klick auf ein Rechercheergebnis stammt
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CHATVERLAUF
-- Nicht Teil der drei Ebenen, aber nötig für Kontext in Folgefragen.
-- ------------------------------------------------------------

create table messages (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INDIZES für die häufigsten Zugriffsmuster
-- ------------------------------------------------------------

create index idx_travelers_trip        on travelers(trip_id);
create index idx_travelers_booking     on travelers(booking_id);
create index idx_bookings_trip         on bookings(trip_id);
create index idx_port_calls_trip       on port_calls(trip_id);
create index idx_findings_trip         on research_findings(trip_id);
create index idx_findings_port_call    on research_findings(port_call_id);
create index idx_memory_trip           on user_memory(trip_id);
create index idx_messages_trip         on messages(trip_id, created_at);
create index idx_excursions_port_call  on port_excursions(port_call_id);
create index idx_excursions_trip       on port_excursions(trip_id);
