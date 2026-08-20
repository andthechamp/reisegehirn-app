const ALLOWED_WIKIMEDIA_HOSTS = /^(commons\.wikimedia\.org|[a-z]{2,3}\.wikipedia\.org)$/;
const ALLOWED_UPLOAD_HOST = "upload.wikimedia.org";

/**
 * Prüft, ob eine URL wirklich auf eine einzelne Datei-Beschreibungsseite bei
 * Wikimedia Commons/Wikipedia zeigt (".../wiki/File:Name.jpg"). Historisch
 * lieferte die KI selbst image_url per Websuche und hielt sich dabei nicht
 * immer an die Vorgabe - z. B. ein Kategorie-Link (".../wiki/Category:...")
 * mit mehreren Bildern unklarer Lizenz statt eines einzelnen Bildes. Bleibt
 * als Kompatibilitäts-Check für so gespeicherte Altdaten erhalten, auch wenn
 * neue Einträge über lookupWikipediaImage() bereits direkte Thumbnail-URLs
 * bekommen (siehe isDirectWikimediaImageUrl).
 */
export function isValidWikimediaFileUrl(fileUrl: string): boolean {
  try {
    const url = new URL(fileUrl);
    return ALLOWED_WIKIMEDIA_HOSTS.test(url.hostname) && /^\/wiki\/File:.+/.test(decodeURIComponent(url.pathname));
  } catch {
    return false;
  }
}

// Direkte Bilddatei-URL, wie sie lookupWikipediaImage() über die
// pageimages-API liefert (schon fertig zum Einbetten, keine Special:FilePath-
// Umleitung nötig).
export function isDirectWikimediaImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === ALLOWED_UPLOAD_HOST;
  } catch {
    return false;
  }
}

/**
 * Löst eine gespeicherte image_url in eine tatsächlich einbettbare Bild-URL
 * auf - unabhängig davon, ob es sich um eine neue direkte Thumbnail-URL
 * (upload.wikimedia.org, von lookupWikipediaImage) oder eine ältere Datei-
 * Beschreibungsseite (".../wiki/File:...", aus der Zeit vor der Umstellung
 * auf serverseitige Bildsuche) handelt. Gibt null zurück, wenn keins von
 * beidem zutrifft, statt eine kaputte <img src> zu riskieren.
 */
export function resolveDisplayImageUrl(url: string, width = 400): string | null {
  if (isDirectWikimediaImageUrl(url)) return url;
  if (!isValidWikimediaFileUrl(url)) return null;
  const parsed = new URL(url);
  const filename = decodeURIComponent(parsed.pathname).replace(/^\/wiki\/File:/, "");
  return `https://${parsed.hostname}/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

interface PageLookupResult {
  title: string;
  articleUrl: string | null;
  thumbnailUrl: string | null;
}

async function fetchPageInfo(params: URLSearchParams): Promise<PageLookupResult | null> {
  try {
    const res = await fetch(`https://de.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: { "User-Agent": "reisegehirn-app/1.0 (Sehenswuerdigkeiten-Bildsuche)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages ?? {}) as Array<{
      missing?: unknown;
      title?: string;
      fullurl?: string;
      thumbnail?: { source?: string };
    }>;
    const page = pages[0];
    if (!page || "missing" in page) return null;
    // Wikipedia liefert als pageimage für Stadt-/Ortsartikel oft nur das
    // Wappen oder die Flagge aus der Infobox (SVG-Grafik, thumbnail-Pfad
    // enthält trotz .png-Endung noch den ursprünglichen .svg-Dateinamen) -
    // für Foto-Hintergründe (Hero, Tageskarten) unbrauchbar, daher verwerfen.
    const thumbnailUrl = page.thumbnail?.source ?? null;
    const isPhoto = thumbnailUrl ? !/\.svg\b/i.test(thumbnailUrl) : false;
    return { title: page.title ?? "", articleUrl: page.fullurl ?? null, thumbnailUrl: isPhoto ? thumbnailUrl : null };
  } catch {
    return null;
  }
}

// Kernname ohne Klammerzusatz ("Hellesylt (Sunnylvsfjord)" -> "hellesylt"),
// wie shortPortName() in TripHero.tsx.
function coreName(name: string): string {
  return name.split("(")[0].trim().toLowerCase();
}

// Die Volltextsuche (generator=search) liefert manchmal den thematisch
// nächstgelegenen statt den tatsächlich passenden Artikel (z. B. landet
// "Hellesylt (Sunnylvsfjord)" beim Nachbarfjord-Artikel "Geirangerfjord",
// weil beide im selben Fjordsystem liegen und sich gegenseitig erwähnen) -
// so ein Treffer zeigt dann das falsche Hafenfoto. Nur akzeptieren, wenn der
// gefundene Artikeltitel den gesuchten Namen tatsächlich enthält.
function titleLooksRelated(title: string, query: string): boolean {
  const core = coreName(query);
  return core.length > 0 && title.toLowerCase().includes(core);
}

/**
 * Deterministischer, kostenloser Ersatz für die frühere KI-Websuche nach
 * Sehenswürdigkeiten-Bildern: fragt direkt die deutsche Wikipedia-API nach
 * Titelbild UND Artikel-URL. Deutlich zuverlässiger als web_search, weil die
 * Top-5-Sehenswürdigkeiten laut Recherche-Prompt ohnehin nach Bekanntheit
 * ausgewählt werden - genau die Kategorie, die auf Wikipedia am besten
 * abgedeckt ist. Erst exakter Titel-Treffer (inkl. Weiterleitungen), dann als
 * Fallback eine Volltextsuche, falls der Name z. B. Zusätze wie "(Runder
 * Turm)" enthält, die nicht exakt dem Artikeltitel entsprechen. articleUrl
 * wird auch ohne Titelbild zurückgegeben (z. B. für einen "Mehr erfahren"-
 * Link) - nur wenn gar kein Artikel gefunden wird, ist das Ergebnis null.
 */
type WikipediaImageResult = { url: string | null; source: "wikipedia" | null; articleUrl: string | null };

// Prozessweiter In-Memory-Cache: derselbe Name (Schiff/Hafen) wird bei jedem
// Trip-Seitenaufruf erneut abgefragt (siehe /api/trips/[id]/route.ts, kein
// DB-Cache wie bei ensurePortCoordinates) - ohne Cache reißt das schnell
// Wikipedias Rate-Limit (429). Treffer sind praktisch für immer gültig
// (Bilder ändern sich für einen Titel so gut wie nie), Fehlschläge aber nur
// kurz cachen - sonst würde ein einzelner 429 während einer Rate-Limit-Spitze
// "kein Foto gefunden" fälschlich bis zum nächsten Server-Neustart einfrieren.
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 60 * 1000;

function ttlCache<T>(hasResult: (v: T) => boolean) {
  const store = new Map<string, { value: T; expires: number }>();
  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      const ttl = hasResult(value) ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
      store.set(key, { value, expires: Date.now() + ttl });
    },
  };
}

const imageCache = ttlCache<WikipediaImageResult>((v) => v.url !== null);

export async function lookupWikipediaImage(name: string, thumbSize = 400): Promise<WikipediaImageResult> {
  const cacheKey = `${name}::${thumbSize}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const result = await lookupWikipediaImageUncached(name, thumbSize);
  imageCache.set(cacheKey, result);
  return result;
}

async function lookupWikipediaImageUncached(name: string, thumbSize: number): Promise<WikipediaImageResult> {
  const commonParams = {
    action: "query",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: String(thumbSize),
    inprop: "url",
    format: "json",
  };

  const exact = await fetchPageInfo(
    new URLSearchParams({ ...commonParams, titles: name, redirects: "1" })
  );
  if (exact?.thumbnailUrl) {
    return { url: exact.thumbnailUrl, source: "wikipedia", articleUrl: exact.articleUrl };
  }

  // Auch wenn der exakte Treffer existiert, aber nur ein Wappen/eine Flagge
  // liefert (isPhoto-Filter in fetchPageInfo hat thumbnailUrl auf null
  // gesetzt): trotzdem die Volltextsuche versuchen, die oft einen
  // fotografischeren Artikel findet (z. B. "Geirangerfjord" statt "Geiranger
  // (Geirangerfjord)").
  const fuzzy = await fetchPageInfo(
    new URLSearchParams({ ...commonParams, generator: "search", gsrsearch: name, gsrlimit: "1" })
  );
  if (fuzzy?.thumbnailUrl && titleLooksRelated(fuzzy.title, name)) {
    return { url: fuzzy.thumbnailUrl, source: "wikipedia", articleUrl: fuzzy.articleUrl };
  }

  return { url: null, source: null, articleUrl: exact?.articleUrl ?? fuzzy?.articleUrl ?? null };
}

// Fallback-Link für eine Sehenswürdigkeit ohne Wikipedia-Artikel - immer
// verfügbar, damit "Mehr erfahren" nie ins Leere läuft.
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export interface CommonsPhotoResult {
  url: string;
  // Fotograf/Urheber aus den Datei-Metadaten (Klartext, HTML-Links entfernt) -
  // null nur, wenn Commons keinen Artist-Eintrag liefert (selten). CC-BY-SA-
  // Lizenzen verlangen eine Namensnennung, siehe README des Design-Handoffs
  // ("Attribution muss mitgeführt werden").
  attribution: string | null;
  licenseShortName: string | null;
}

// Dateinamen, die zwar zur Suche passen, aber keine brauchbaren Foto-
// Hintergründe sind (Landkarten, Wappen, Logos, historische Seekarten o. Ä.).
const BLOCKED_TITLE_WORDS = /(chart|karte|map|wappen|flagge|flag of|coat of arms|logo|siegel|\bplan\b|diagram|grundriss)/i;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

const commonsCache = ttlCache<CommonsPhotoResult | null>((v) => v !== null);

/**
 * Durchsucht Wikimedia Commons direkt nach freien Fotos (statt nur dem
 * Titelbild EINES Wikipedia-Artikels wie lookupWikipediaImage) - findet damit
 * auch dann ein gutes Foto, wenn der zugehörige Wikipedia-Artikel gar kein
 * Bild hat oder nur ein Wappen zeigt. Bevorzugt querformatige Treffer (besser
 * für volle Foto-Hintergründe) und liefert die Attribution mit, da Commons-
 * Fotos anders als offizielle Wikipedia-Titelbilder meist CC BY-SA sind.
 */
export async function searchCommonsPhoto(query: string, thumbWidth = 900): Promise<CommonsPhotoResult | null> {
  const cacheKey = `${query}::${thumbWidth}`;
  const cached = commonsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = await searchCommonsPhotoUncached(query, thumbWidth);
  commonsCache.set(cacheKey, result);
  return result;
}

async function searchCommonsPhotoUncached(query: string, thumbWidth: number): Promise<CommonsPhotoResult | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: `${query} filetype:bitmap`,
      gsrlimit: "10",
      gsrsort: "relevance",
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: String(thumbWidth),
      format: "json",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { "User-Agent": "reisegehirn-app/1.0 (Hafen-/Schiffsfotos)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages ?? {}) as Array<{
      title?: string;
      imageinfo?: Array<{
        thumburl?: string;
        width?: number;
        height?: number;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;

    // "Hellesylt Hafen" o. ä. - für den Relevanz-Check den Suffix wieder
    // abstreifen, sonst würde kaum ein Dateiname exakt "hellesylt hafen"
    // enthalten (siehe titleLooksRelated/resolvePortPhoto).
    const expectedCore = coreName(query.replace(/\s+Hafen$/i, ""));

    const candidates = pages
      .map((p) => ({ title: p.title ?? "", info: p.imageinfo?.[0] }))
      .filter(
        (c) =>
          c.info?.thumburl &&
          !BLOCKED_TITLE_WORDS.test(c.title) &&
          (expectedCore.length === 0 || c.title.toLowerCase().includes(expectedCore))
      );
    if (candidates.length === 0) return null;

    const landscape = candidates.find((c) => (c.info!.width ?? 0) >= (c.info!.height ?? 1));
    const chosen = landscape ?? candidates[0];
    const meta = chosen.info!.extmetadata ?? {};
    const artistRaw = meta.Artist?.value;

    return {
      url: chosen.info!.thumburl!,
      attribution: artistRaw ? stripHtml(artistRaw) : null,
      licenseShortName: meta.LicenseShortName?.value ?? null,
    };
  } catch {
    return null;
  }
}
