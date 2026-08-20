import { existsSync, readFileSync } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupWikipediaImage, searchCommonsPhoto } from "@/lib/wikimedia";

export interface PlacePhoto {
  url: string | null;
  // Nur gesetzt, wenn die Quelle eine Namensnennung verlangt (Commons-Fotos
  // per Suche, oder ein lokal hinterlegtes Foto mit Sidecar-JSON) - nicht bei
  // eigenen Fotos ohne Sidecar oder offiziellen Wikipedia-Titelbildern.
  attribution: string | null;
  licenseShortName: string | null;
}

const EMPTY_PHOTO: PlacePhoto = { url: null, attribution: null, licenseShortName: null };

// Manche Schiffe/Häfen (z. B. "Mein Schiff 1") haben keinen eigenen
// Wikipedia-Artikel mit Titelbild - die Weiterleitung landet auf einem
// Sammelartikel ohne Foto (siehe lookupWikipediaImage). Für solche Fälle
// lässt sich ein eigenes Foto unter public/<dir>/<slug>.jpg hinterlegen, das
// dann Vorrang vor der automatischen Suche bekommt. Eine gleichnamige
// <slug>.json daneben (z. B. liverpool.json) trägt optional die Attribution
// nach, falls das Foto (wie von Commons heruntergeladene Fotos) eine
// Namensnennung verlangt - ganz eigene Fotos ohne Sidecar brauchen keine.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function localPhoto(dir: "ship-photos" | "port-photos", name: string): PlacePhoto | null {
  const slug = slugify(name);
  const imagePath = path.join(process.cwd(), "public", dir, `${slug}.jpg`);
  if (!existsSync(imagePath)) return null;

  const url = `/${dir}/${slug}.jpg`;
  const sidecarPath = path.join(process.cwd(), "public", dir, `${slug}.json`);
  if (existsSync(sidecarPath)) {
    try {
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
        attribution?: string;
        licenseShortName?: string;
      };
      return { url, attribution: sidecar.attribution ?? null, licenseShortName: sidecar.licenseShortName ?? null };
    } catch (err) {
      console.error(`Sidecar-JSON für "${name}" (${sidecarPath}) ungültig:`, err);
    }
  }
  return { url, attribution: null, licenseShortName: null };
}

export function localShipPhotoUrl(shipName: string): string | null {
  return localPhoto("ship-photos", shipName)?.url ?? null;
}

export function localPortPhotoUrl(portName: string): string | null {
  return localPhoto("port-photos", portName)?.url ?? null;
}

async function resolveShipPhotoLive(shipName: string, thumbWidth = 1200): Promise<PlacePhoto> {
  const wiki = await lookupWikipediaImage(shipName, thumbWidth);
  if (wiki.url) return { url: wiki.url, attribution: null, licenseShortName: null };

  const commons = await searchCommonsPhoto(shipName, thumbWidth);
  return commons ?? EMPTY_PHOTO;
}

// Kernname ohne Klammerzusatz ("Hamburg (Einschiffung)" -> "Hamburg",
// "Geiranger (Geirangerfjord)" -> "Geiranger") - wie shortPortName() in
// TripHero.tsx. Dient hier zusätzlich als Cache-Schlüssel: unterschiedliche
// port_calls desselben physischen Hafens (Ein-/Ausschiffung, mehrfache
// Anläufe) sollen sich EIN Foto teilen statt getrennt aufgelöst zu werden.
function portCoreName(portName: string): string {
  return portName.split("(")[0].trim();
}

async function resolvePortPhotoLive(coreName: string, thumbWidth = 900): Promise<PlacePhoto> {
  const wiki = await lookupWikipediaImage(coreName, thumbWidth);
  if (wiki.url) return { url: wiki.url, attribution: null, licenseShortName: null };

  // Klammerzusätze verwirren die Commons-Volltextsuche eher, als dass sie
  // helfen - coreName ist hier bereits der bereinigte Name.
  const withHafen = await searchCommonsPhoto(`${coreName} Hafen`, thumbWidth);
  if (withHafen) return withHafen;

  const plain = await searchCommonsPhoto(coreName, thumbWidth);
  return plain ?? EMPTY_PHOTO;
}

// Negative Cache-Treffer (kein Foto gefunden) nach dieser Zeit erneut
// versuchen - Commons/Wikipedia wachsen ständig, ein heute erfolgloser
// Hafen kann in ein paar Wochen einen Treffer haben. Positive Treffer laufen
// nie ab (wie port_coordinates: ein einmal gefundenes Foto bleibt gültig).
const PLACE_PHOTO_RECHECK_DAYS = 30;

interface PlacePhotoRow {
  name: string;
  url: string | null;
  attribution: string | null;
  license_short_name: string | null;
  checked_at: string;
}

/**
 * Lädt Fotos für die übergebenen Namen aus dem place_photos-Cache
 * (dauerhaft, DB-gestützt statt nur In-Memory - siehe schema.sql) und löst
 * fehlende/veraltete Einträge live nach (erst lokale Datei, dann Wikipedia,
 * dann Commons-Suche - siehe resolve()). Ohne diesen DB-Cache würde jeder
 * Trip-Seitenaufruf alle Häfen erneut bei Wikipedia/Commons abfragen und
 * schnell deren Rate-Limit reißen.
 */
async function ensurePlacePhotos(
  supabase: SupabaseClient,
  dir: "ship-photos" | "port-photos",
  names: string[],
  resolveLive: (name: string) => Promise<PlacePhoto>
): Promise<Map<string, PlacePhoto>> {
  const uniqueNames = [...new Set(names)];
  const result = new Map<string, PlacePhoto>();
  if (uniqueNames.length === 0) return result;

  // Lokale Overrides gelten immer, unabhängig vom DB-Cache - sonst würde ein
  // nachträglich hinterlegtes Foto erst nach Ablauf eines evtl. bereits
  // gecachten negativen Treffers greifen.
  const remaining: string[] = [];
  for (const name of uniqueNames) {
    const local = localPhoto(dir, name);
    if (local) {
      result.set(name, local);
    } else {
      remaining.push(name);
    }
  }
  if (remaining.length === 0) return result;

  const { data: cached, error: cacheError } = await supabase
    .from("place_photos")
    .select("name, url, attribution, license_short_name, checked_at")
    .in("name", remaining);
  if (cacheError) throw cacheError;

  const recheckCutoff = Date.now() - PLACE_PHOTO_RECHECK_DAYS * 86_400_000;
  const missing: string[] = [];
  for (const name of remaining) {
    const row = (cached as PlacePhotoRow[] | null)?.find((r) => r.name === name);
    if (!row || (row.url === null && new Date(row.checked_at).getTime() < recheckCutoff)) {
      missing.push(name);
      continue;
    }
    result.set(name, { url: row.url, attribution: row.attribution, licenseShortName: row.license_short_name });
  }
  if (missing.length === 0) return result;

  await Promise.all(
    missing.map(async (name) => {
      let photo: PlacePhoto;
      try {
        photo = await resolveLive(name);
      } catch (err) {
        console.error(`Fotosuche fehlgeschlagen für "${name}":`, err);
        photo = EMPTY_PHOTO;
      }

      // Zwei überlappende Anfragen für denselben Namen (z. B. React
      // StrictMode im Dev-Modus, das Effects doppelt feuert, oder zwei
      // Nutzer:innen, die gleichzeitig eine Reise mit demselben Hafen laden)
      // sehen im obigen SELECT beide "fehlt noch" und lösen beide live auf -
      // ohne diese Prüfung könnte ein verspäteter Fehlschlag (z. B. durch
      // genau diese Verdopplung ausgelöstes Rate-Limit) einen bereits
      // gespeicherten Treffer wieder überschreiben. Ein Negativergebnis
      // daher nie über einen schon vorhandenen Treffer schreiben.
      if (photo.url === null) {
        const { data: existing } = await supabase
          .from("place_photos")
          .select("url, attribution, license_short_name")
          .eq("name", name)
          .maybeSingle();
        if (existing?.url) {
          result.set(name, {
            url: existing.url,
            attribution: existing.attribution,
            licenseShortName: existing.license_short_name,
          });
          return;
        }
      }

      result.set(name, photo);
      const { error: upsertError } = await supabase.from("place_photos").upsert(
        {
          name,
          url: photo.url,
          attribution: photo.attribution,
          license_short_name: photo.licenseShortName,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "name" }
      );
      if (upsertError) console.error(`Speichern des Fotos für "${name}" fehlgeschlagen:`, upsertError);
    })
  );

  return result;
}

export async function ensureShipPhoto(supabase: SupabaseClient, shipName: string): Promise<PlacePhoto> {
  const map = await ensurePlacePhotos(supabase, "ship-photos", [shipName], (name) => resolveShipPhotoLive(name));
  return map.get(shipName) ?? EMPTY_PHOTO;
}

export async function ensurePortPhotos(
  supabase: SupabaseClient,
  portNames: string[]
): Promise<Map<string, PlacePhoto>> {
  // Auf Kernnamen normalisieren, BEVOR der Cache befragt wird - sonst würden
  // "Hamburg (Einschiffung)" und "Hamburg (Ausschiffung)" als zwei
  // verschiedene Häfen behandelt (siehe portCoreName()).
  const originalToCore = new Map(portNames.map((name) => [name, portCoreName(name)]));
  const coreNames = [...new Set(originalToCore.values())];
  const coreResults = await ensurePlacePhotos(supabase, "port-photos", coreNames, (core) =>
    resolvePortPhotoLive(core)
  );

  const result = new Map<string, PlacePhoto>();
  for (const [original, core] of originalToCore) {
    result.set(original, coreResults.get(core) ?? EMPTY_PHOTO);
  }
  return result;
}
