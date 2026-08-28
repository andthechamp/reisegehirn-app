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
  // Kurzer Klartext-Auszug der Einleitung - dient NUR der Disambiguierung
  // gleichnamiger Artikel (siehe matchesCity in lookupWikipediaImageUncached),
  // nicht der Anzeige.
  extract: string | null;
}

async function fetchPageInfo(params: URLSearchParams, lang: "de" | "en" = "de"): Promise<PageLookupResult | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: { "User-Agent": "reisegehirn-app/1.0 (Sehenswuerdigkeiten-Bildsuche)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages ?? {}) as Array<{
      missing?: unknown;
      title?: string;
      fullurl?: string;
      thumbnail?: { source?: string };
      extract?: string;
    }>;
    const page = pages[0];
    if (!page || "missing" in page) return null;
    // Wikipedia liefert als pageimage für Stadt-/Ortsartikel oft nur das
    // Wappen oder die Flagge aus der Infobox (SVG-Grafik, thumbnail-Pfad
    // enthält trotz .png-Endung noch den ursprünglichen .svg-Dateinamen) -
    // für Foto-Hintergründe (Hero, Tageskarten) unbrauchbar, daher verwerfen.
    const thumbnailUrl = page.thumbnail?.source ?? null;
    const isPhoto = thumbnailUrl ? !/\.svg\b/i.test(thumbnailUrl) : false;
    return {
      title: page.title ?? "",
      articleUrl: page.fullurl ?? null,
      thumbnailUrl: isPhoto ? thumbnailUrl : null,
      extract: page.extract ?? null,
    };
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

// Viele Sehenswürdigkeiten-Namen sind stadtübergreifend mehrdeutig (z. B.
// "Alter Botanischer Garten" gibt es als eigenständigen Wikipedia-Artikel
// sowohl für Tübingen als auch für andere Städte) - ein exakter Titeltreffer
// ALLEIN beweist also nicht, dass der Artikel zum recherchierten Hafen
// gehört. Ohne diesen Check hätte Kiel fälschlich das Tübinger Foto bekommen.
// Prüft daher, ob der Hafenname im Artikeltitel oder in der Einleitung
// auftaucht - reicht ohne portCore (kein Kontext übergeben) automatisch durch.
function matchesCity(result: Pick<PageLookupResult, "title" | "extract">, portCore: string | null): boolean {
  if (!portCore) return true;
  const haystack = `${result.title} ${result.extract ?? ""}`.toLowerCase();
  return haystack.includes(portCore);
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

// portName ist optional (siehe matchesCity) - Aufrufer ohne Stadtkontext
// (z. B. ship-photos.ts für Schiffsnamen, die nicht mehrdeutig sind) bleiben
// unverändert.
export async function lookupWikipediaImage(
  name: string,
  thumbSize = 400,
  portName?: string
): Promise<WikipediaImageResult> {
  const cacheKey = `${name}::${thumbSize}::${portName ?? ""}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const result = await lookupWikipediaImageUncached(name, thumbSize, portName);
  imageCache.set(cacheKey, result);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Abstand zwischen den bis zu vier Wikipedia-Anfragen EINER Sehenswürdigkeit
// (DE exakt/fuzzy, EN exakt/fuzzy) - ohne diese Pause feuert eine einzelne
// Sehenswürdigkeit ohne deutschen Artikel vier Anfragen praktisch
// gleichzeitig ab, was Wikipedias anonymes Rate-Limit auch bei insgesamt
// niedrigem Gesamtaufkommen auslöst (der Burst zählt, nicht nur die Summe).
const WIKIPEDIA_REQUEST_GAP_MS = 400;

async function lookupWikipediaImageUncached(
  name: string,
  thumbSize: number,
  portName?: string
): Promise<WikipediaImageResult> {
  const commonParams = {
    action: "query",
    prop: "pageimages|info|extracts",
    piprop: "thumbnail",
    pithumbsize: String(thumbSize),
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exchars: "600",
    format: "json",
  };
  const portCore = portName ? coreName(portName) : null;
  // Für den Disambiguierungs-Titel ("Alter Botanischer Garten (Kiel)") die
  // Original-Schreibweise verwenden, nicht coreName() (der ist lowercase und
  // für den Vergleich gedacht, nicht für einen Wikipedia-Titel).
  const portDisplayName = portName ? portName.split("(")[0].trim() : null;

  let fallbackArticleUrl: string | null = null;
  let isFirstRequest = true;
  const throttledFetch = async (params: URLSearchParams, lang: "de" | "en") => {
    if (!isFirstRequest) await sleep(WIKIPEDIA_REQUEST_GAP_MS);
    isFirstRequest = false;
    return fetchPageInfo(params, lang);
  };

  // Erst Deutsch (liefert die "Mehr erfahren"-Links auf Deutsch), dann
  // Englisch als zweiter Versuch: viele Sehenswürdigkeiten außerhalb
  // deutschsprachiger Länder haben schlicht keinen deutschen Artikel, aber
  // einen englischen mit Foto (z. B. "St Anne's Cathedral" in Belfast) - ohne
  // diesen Fallback blieb ein Großteil internationaler Ziele bildlos, obwohl
  // Wikipedia das Bild längst hätte.
  for (const lang of ["de", "en"] as const) {
    const exact = await throttledFetch(new URLSearchParams({ ...commonParams, titles: name, redirects: "1" }), lang);
    fallbackArticleUrl = fallbackArticleUrl ?? exact?.articleUrl ?? null;
    if (exact?.thumbnailUrl) {
      if (matchesCity(exact, portCore)) {
        return { url: exact.thumbnailUrl, source: "wikipedia", articleUrl: exact.articleUrl };
      }
      // Exakter Titeltreffer, aber Artikel gehört erkennbar zu einer anderen
      // Stadt (z. B. "Alter Botanischer Garten" -> Tübingen statt Kiel) -
      // Wikipedia disambiguiert solche Fälle oft über einen Klammerzusatz
      // ("Alter Botanischer Garten (Kiel)"), also gezielt danach fragen,
      // bevor auf die Volltextsuche zurückgefallen wird.
      if (portDisplayName) {
        const disambiguated = await throttledFetch(
          new URLSearchParams({ ...commonParams, titles: `${name} (${portDisplayName})`, redirects: "1" }),
          lang
        );
        fallbackArticleUrl = fallbackArticleUrl ?? disambiguated?.articleUrl ?? null;
        if (disambiguated?.thumbnailUrl) {
          return { url: disambiguated.thumbnailUrl, source: "wikipedia", articleUrl: disambiguated.articleUrl };
        }
      }
    }

    // Auch wenn der exakte Treffer existiert, aber nur ein Wappen/eine Flagge
    // liefert (isPhoto-Filter in fetchPageInfo hat thumbnailUrl auf null
    // gesetzt): trotzdem die Volltextsuche versuchen, die oft einen
    // fotografischeren Artikel findet (z. B. "Geirangerfjord" statt
    // "Geiranger (Geirangerfjord)").
    const fuzzy = await throttledFetch(
      new URLSearchParams({ ...commonParams, generator: "search", gsrsearch: name, gsrlimit: "1" }),
      lang
    );
    fallbackArticleUrl = fallbackArticleUrl ?? fuzzy?.articleUrl ?? null;
    if (fuzzy?.thumbnailUrl && titleLooksRelated(fuzzy.title, name) && matchesCity(fuzzy, portCore)) {
      return { url: fuzzy.thumbnailUrl, source: "wikipedia", articleUrl: fuzzy.articleUrl };
    }
  }

  return { url: null, source: null, articleUrl: fallbackArticleUrl };
}

// Fallback-Link für eine Sehenswürdigkeit ohne Wikipedia-Artikel - immer
// verfügbar, damit "Mehr erfahren" nie ins Leere läuft.
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export interface SightImageResult {
  url: string | null;
  source: "wikipedia" | "wikimedia_commons" | null;
  articleUrl: string | null;
  // Nur bei source "wikimedia_commons" gesetzt (CC-BY-SA-Namensnennungspflicht).
  attribution: string | null;
}

/**
 * Bildsuche für eine einzelne Sehenswürdigkeit: erst das Titelbild ihres
 * eigenen Wikipedia-Artikels (lookupWikipediaImage - zuverlässigste Quelle,
 * aber viele Sehenswürdigkeiten ohne eigenen Artikel liefern hier nichts),
 * sonst als zweiten Versuch eine Commons-weite Fotosuche (searchCommonsPhoto -
 * findet auch dann ein Bild, wenn kein Wikipedia-Artikel existiert, aber
 * jemand ein Foto mit dem Namen auf Commons hochgeladen hat). Der Hafenname
 * fließt bewusst NICHT mit in die Commons-Suchanfrage ein: searchCommonsPhoto()
 * verlangt, dass der gefundene Dateiname den gesamten Suchbegriff als
 * zusammenhängenden String enthält (siehe expectedCore dort) - ein
 * angehängter Hafenname wie "Montego Bay" taucht in Dateinamen wie
 * "DoctorsCaveBeach.jpeg" nie wortwörtlich auf und hätte jeden Treffer
 * verworfen.
 */
export async function lookupSightImage(name: string, portName?: string): Promise<SightImageResult> {
  const wiki = await lookupWikipediaImage(name, 400, portName);
  if (wiki.url) return { url: wiki.url, source: "wikipedia", articleUrl: wiki.articleUrl, attribution: null };

  // Abstand zur vorangegangenen Wikipedia-Anfrage, aus demselben Grund wie
  // WIKIPEDIA_REQUEST_GAP_MS oben - Commons läuft unter derselben
  // Wikimedia-Infrastruktur.
  await sleep(WIKIPEDIA_REQUEST_GAP_MS);
  const commons = await searchCommonsPhoto(name, 900, portName ? coreName(portName) : undefined);
  if (commons) {
    return {
      url: commons.url,
      source: "wikimedia_commons",
      articleUrl: wiki.articleUrl,
      attribution: commons.attribution,
    };
  }

  return { url: null, source: null, articleUrl: wiki.articleUrl, attribution: null };
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
// portCore: siehe matchesCity - wird NICHT in gsrsearch aufgenommen (bricht
// den Dateiname-Abgleich, siehe Kommentar an lookupSightImage), sondern
// filtert erst die gefundenen Kandidaten über deren Beschreibung/Kategorien.
export async function searchCommonsPhoto(
  query: string,
  thumbWidth = 900,
  portCore?: string
): Promise<CommonsPhotoResult | null> {
  const cacheKey = `${query}::${thumbWidth}::${portCore ?? ""}`;
  const cached = commonsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = await searchCommonsPhotoUncached(query, thumbWidth, portCore);
  commonsCache.set(cacheKey, result);
  return result;
}

async function searchCommonsPhotoUncached(
  query: string,
  thumbWidth: number,
  portCore?: string
): Promise<CommonsPhotoResult | null> {
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
    // Commons-Dateinamen trennen Wörter fast nie durch Leerzeichen
    // ("DoctorsCaveBeach.jpeg", "Doctors-Cave-Beach.jpg") - ein Vergleich mit
    // Leerzeichen im Suchbegriff würde daher fast jeden echten Treffer
    // verwerfen. Leerzeichen/Bindestriche/Unterstriche vor dem Vergleich auf
    // beiden Seiten entfernen.
    const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
    const expectedCoreNormalized = normalize(expectedCore);

    let candidates = pages
      .map((p) => ({ title: p.title ?? "", info: p.imageinfo?.[0] }))
      .filter(
        (c) =>
          c.info?.thumburl &&
          !BLOCKED_TITLE_WORDS.test(c.title) &&
          (expectedCoreNormalized.length === 0 || normalize(c.title).includes(expectedCoreNormalized))
      );
    if (candidates.length === 0) return null;

    // Ein Dateiname, der den Sehenswürdigkeitsnamen enthält, garantiert nicht
    // die richtige Stadt (z. B. "Alter Botanischer Garten" existiert auf
    // Commons für mehrere Städte) - bei bekanntem Hafen daher zusätzlich über
    // Bildbeschreibung/Kategorien verifizieren. Kein Kandidat bestätigt die
    // Stadt -> lieber gar kein Bild als ein falsches (siehe matchesCity).
    if (portCore) {
      const cityConfirmed = candidates.filter((c) => {
        const meta = c.info!.extmetadata ?? {};
        const haystack = `${c.title} ${meta.ImageDescription?.value ?? ""} ${meta.Categories?.value ?? ""}`.toLowerCase();
        return haystack.includes(portCore);
      });
      if (cityConfirmed.length === 0) return null;
      candidates = cityConfirmed;
    }

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
