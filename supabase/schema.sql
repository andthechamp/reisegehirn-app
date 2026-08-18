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

-- Hafeninfos, die NICHT vom Schiff/der Reise abhängen (Anleger, zu Fuß, Essen,
-- Praktisches, Sehenswürdigkeiten, Wetter/Packen), sind ebenfalls nicht
-- reisespezifisch - geschlüsselt über port_name statt trip_id, analog
-- ship_research. Reederei-/private Ausflüge (category 'ausflug_offiziell'/
-- 'ausflug_privat') bleiben bewusst in research_findings, trip-gebunden, da
-- sich das Angebot je Schiff/Reederei unterscheiden kann - siehe
-- SHARED_PORT_CATEGORIES in src/lib/research-schema.ts. Frische wird lazy
-- beim Abruf geprüft (7 Tage), nicht per Cron wie bei ship_research, da die
-- Zahl möglicher Häfen die Flottengröße deutlich übersteigt.
create table port_research (
  id           uuid primary key default gen_random_uuid(),
  port_name    text not null,
  category     text not null check (category in (
                 'anleger', 'zu_fuss', 'essen', 'praktisches',
                 'sehenswuerdigkeiten', 'wetter_packen', 'sonstiges',
                 -- insider_tipps/ausflug_privat kommen NICHT aus der
                 -- automatischen Websuche-Recherche (siehe SHARED_PORT_CATEGORIES
                 -- in research-schema.ts, die weiterhin unverändert bleibt) -
                 -- sie sind hier nur für redaktionell kuratierte Einträge
                 -- erlaubt (siehe curated-Spalte unten), z. B. von einem
                 -- Reisebüro zusammengestellte Insider-Tipps oder private
                 -- Ausflugsanbieter, die nicht reedereigebunden sind.
                 'insider_tipps', 'ausflug_privat'
               )),
  title        text not null,
  content      text not null,
  -- Nur für category 'sehenswuerdigkeiten' befüllt: maßgebliche strukturierte
  -- Fassung der 5 Sehenswürdigkeiten, je Eintrag { name, description,
  -- image_url, image_source }, Bilder ausschließlich von Wikimedia Commons/
  -- Wikipedia (siehe buildPortResearchPrompt) - sonst null. Bewusst getrennt
  -- von content (das bleibt Fließtext für Chat-Kontext/Suche), damit die
  -- Bild-Anzeige nicht am fragilen Parsen der nummerierten Liste in content hängt.
  items        jsonb,
  source_tier  text not null check (source_tier in ('A', 'B', 'C')),
  source_name  text,
  source_url   text,
  staleness    text not null default 'saisonal'
                 check (staleness in ('zeitlos', 'saisonal', 'verfällt')),
  sort_order   int not null default 0,
  retrieved_at timestamptz not null default now(),
  -- true = redaktionell/manuell gepflegt (z. B. per Seed-Skript aus einer
  -- Reisebüro-Tippliste), nicht das Ergebnis der KI-Websuche-Recherche.
  -- researchAndSavePort löscht beim erneuten Recherchieren eines Hafens nur
  -- curated = false Zeilen, damit kuratierte Einträge einen Refresh überleben.
  curated      boolean not null default false
);

create index idx_port_research_name on port_research(port_name);

-- Wissen, das an eine Route/Region gebunden ist statt an einen einzelnen
-- Hafen oder ein Schiff (z. B. "eSIM lohnt sich in der Karibik" oder
-- "Vorabend-Check-in nutzen, wenn per Flug angereist wird"). Es gibt aktuell
-- keine automatische Trip->Region-Erkennung (trips.route_name ist Freitext) -
-- die Zuordnung läuft über REGION_PORTS in src/lib/route-research.ts, das
-- die port_calls eines Trips gegen eine kuratierte Liste bekannter Häfen je
-- Region abgleicht. Ausschließlich redaktionell/manuell befüllt (kein
-- KI-Recherche-Pfad), daher kein curated-Flag nötig wie bei port_research.
create table route_research (
  id           uuid primary key default gen_random_uuid(),
  region       text not null,
  category     text not null check (category in ('praktisches', 'insider_tipps', 'sonstiges')),
  title        text not null,
  content      text not null,
  -- Freitext-Einschränkung, wann der Tipp gilt, z. B. "nur bei Anreise per
  -- Flug" oder "vor allem in der Karibik relevant" - rein informativ für die
  -- Anzeige, keine strukturierte Filterlogik.
  conditions   text,
  source_tier  text not null check (source_tier in ('A', 'B', 'C')),
  source_name  text,
  source_url   text,
  staleness    text not null default 'zeitlos'
                 check (staleness in ('zeitlos', 'saisonal', 'verfällt')),
  sort_order   int not null default 0,
  retrieved_at timestamptz not null default now()
);

create index idx_route_research_region on route_research(region);

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

-- ============================================================
-- NUTZERKONTEN, ROLLEN & FREIGABEN
--
-- Auth selbst übernimmt Supabase (auth.users). Diese Migration ergänzt:
--   - profiles       : öffentlich lesbares Nutzerprofil inkl. Rolle
--   - trips.owner_id : jede Reise gehört genau einem Konto
--   - trip_members   : zusätzliche Konten, mit denen eine Reise geteilt wurde
--   - RLS-Policies auf allen Tabellen, damit Postgres selbst durchsetzt,
--     wer welche Zeilen sehen/ändern darf (statt das in jeder Route manuell
--     nachzubauen)
-- ============================================================

-- ------------------------------------------------------------
-- PROFILE & ROLLEN
-- ------------------------------------------------------------

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Legt bei jeder Neuregistrierung automatisch die passende profiles-Zeile an,
-- damit die App nie mit einem auth.users-Eintrag ohne Profil umgehen muss.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Reisegehirn ist für einen geschlossenen Nutzerkreis gedacht (Familie/
-- Freunde) - freie Registrierung würde jedem mit der URL erlauben, sich
-- selbst ein Konto anzulegen und danach über /api/chat, /api/extract,
-- /api/research/* den Anthropic-API-Key der Betreiber zu verbrauchen. Die
-- Prüfung sitzt als BEFORE INSERT-Trigger direkt auf auth.users (nicht nur
-- im Next.js-Code), damit sie auch greift, wenn jemand die Supabase
-- Auth-API direkt anspricht statt über die App-UI - Anon-Key und
-- Projekt-URL sind ohnehin öffentlich im Browser-Bundle sichtbar.
create table allowed_signup_emails (
  email       text primary key,
  created_at  timestamptz not null default now()
);

create function public.check_signup_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_signup_emails where email = lower(new.email)
  ) then
    raise exception 'Registrierung für diese E-Mail-Adresse ist nicht freigeschaltet.';
  end if;
  return new;
end;
$$;

create trigger before_user_signup_check_allowlist
  before insert on auth.users
  for each row execute procedure public.check_signup_allowed();

-- security definer, damit der Aufruf nicht an der eigenen RLS-Policy von
-- profiles scheitert (sonst bräuchte man eine Policy, die wiederum diese
-- Funktion braucht - Zirkelbezug).
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- REISEN-BESITZ & FREIGABE
-- ------------------------------------------------------------

alter table trips add column owner_id uuid references auth.users(id) on delete cascade;
alter table trips alter column owner_id set default auth.uid();

-- Konten, mit denen eine Reise zusätzlich zum Besitzer geteilt wurde (z. B.
-- Partner/Familie). Der Besitzer selbst braucht keine Zeile hier - das wird
-- direkt über trips.owner_id geprüft.
create table trip_members (
  trip_id     uuid not null references trips(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Zentrale Zugriffsprüfung: Besitzer ODER Mitglied. security definer, damit
-- die Funktion trotz RLS auf trips/trip_members selbst auswerten kann, ohne
-- dass die aufrufende Policy Zugriff auf diese Tabellen bräuchte.
create function public.has_trip_access(check_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = check_trip_id and t.owner_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members tm
    where tm.trip_id = check_trip_id and tm.user_id = auth.uid()
  );
$$;

-- Für die "Reise teilen"-Funktion: Konto per E-Mail finden, ohne dass die
-- aufrufende Person direkten Lesezugriff auf fremde profiles-Zeilen braucht.
-- Gibt bewusst nur die id zurück, keine weiteren Profildaten.
create function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profiles where email = lookup_email limit 1;
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table profiles         enable row level security;
alter table trips            enable row level security;
alter table trip_members     enable row level security;
alter table bookings         enable row level security;
alter table travelers        enable row level security;
alter table port_calls       enable row level security;
alter table port_excursions  enable row level security;
alter table research_findings enable row level security;
alter table ship_research    enable row level security;
alter table port_research    enable row level security;
alter table route_research   enable row level security;
alter table user_memory      enable row level security;
alter table messages         enable row level security;
-- allowed_signup_emails: keine Policies (analog zu profiles.role) - Lesen/
-- Schreiben läuft ausschließlich über den Service-Role-Client in
-- /api/admin/invites, damit kein eingeloggtes Konto die eigene Freischaltung
-- selbst verwalten oder andere E-Mails einsehen kann.
alter table allowed_signup_emails enable row level security;

-- profiles: jede*r sieht das eigene Profil, Admins sehen alle. Änderungen
-- (insb. role) laufen bewusst nur über den Service-Role-Key im Admin-Bereich,
-- daher keine update/insert-Policy für normale Nutzer.
create policy "profiles: select own or admin" on profiles
  for select using (id = auth.uid() or public.is_admin());

-- trips: sichtbar/änderbar für Besitzer und Mitglieder; löschen nur Besitzer.
create policy "trips: select if owner or member" on trips
  for select using (owner_id = auth.uid() or public.has_trip_access(id));
create policy "trips: insert own" on trips
  for insert with check (owner_id = auth.uid());
create policy "trips: update if owner or member" on trips
  for update using (owner_id = auth.uid() or public.has_trip_access(id));
create policy "trips: delete if owner" on trips
  for delete using (owner_id = auth.uid());

-- trip_members: nur der Besitzer der Reise verwaltet Freigaben; Mitglieder
-- dürfen sehen, mit wem die Reise geteilt ist.
create policy "trip_members: select if owner or member" on trip_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid())
  );
create policy "trip_members: insert if owner" on trip_members
  for insert with check (
    exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid())
  );
create policy "trip_members: delete if owner" on trip_members
  for delete using (
    exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

-- Alle reisegebundenen Tabellen teilen dasselbe Muster: voller Zugriff für
-- jeden mit has_trip_access() auf die jeweilige trip_id.
create policy "bookings: access via trip" on bookings
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "travelers: access via trip" on travelers
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "port_calls: access via trip" on port_calls
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "port_excursions: access via trip" on port_excursions
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "research_findings: access via trip" on research_findings
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "user_memory: access via trip" on user_memory
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));
create policy "messages: access via trip" on messages
  for all using (public.has_trip_access(trip_id)) with check (public.has_trip_access(trip_id));

-- ship_research ist nicht reisespezifisch (Cache pro Schiffsname, siehe oben)
-- und enthält keine personenbezogenen Daten - für jedes eingeloggte Konto
-- lesbar und schreibbar.
create policy "ship_research: any authenticated user" on ship_research
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- port_research: gleiches Muster wie ship_research (nicht reisespezifisch,
-- keine personenbezogenen Daten).
create policy "port_research: any authenticated user" on port_research
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- route_research: gleiches Muster (nicht reisespezifisch, keine
-- personenbezogenen Daten).
create policy "route_research: any authenticated user" on route_research
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index idx_trip_members_user on trip_members(user_id);
create index idx_trips_owner       on trips(owner_id);

-- Anzeigename, den Nutzer*innen selbst über /account pflegen (statt nur die
-- rohe E-Mail-Adresse im Header/bei Freigaben anzuzeigen). Änderungen laufen
-- über /api/profile mit dem Service-Role-Key, nicht über eine RLS-Policy -
-- gleicher Grund wie bei role: eine Update-Policy auf profiles müsste sonst
-- die role-Spalte vor Selbst-Änderung schützen.
alter table profiles add column full_name text;

-- Nutzer*innen können den Chat (nur den Chat, nicht die restliche Oberfläche)
-- auf eine andere Sprache als Deutsch umstellen - z. B. für Familienmitglieder,
-- die selbst kein Deutsch sprechen. Steuert nur, in welcher Sprache Claude in
-- /api/chat antwortet (siehe buildChatSystemPrompt in src/lib/prompts.ts).
alter table profiles add column chat_language text not null default 'de' check (chat_language in ('de', 'vi'));

-- ------------------------------------------------------------
-- ERSTEN ADMIN FREISCHALTEN
-- Nach der ersten Registrierung einmalig in der Supabase SQL-Konsole:
--   update public.profiles set role = 'admin' where email = 'deine@mail.de';
-- ------------------------------------------------------------
