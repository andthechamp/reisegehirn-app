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
      fullurl?: string;
      thumbnail?: { source?: string };
    }>;
    const page = pages[0];
    if (!page || "missing" in page) return null;
    return { articleUrl: page.fullurl ?? null, thumbnailUrl: page.thumbnail?.source ?? null };
  } catch {
    return null;
  }
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
export async function lookupWikipediaImage(
  name: string
): Promise<{ url: string | null; source: "wikipedia" | null; articleUrl: string | null } | null> {
  const commonParams = {
    action: "query",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "400",
    inprop: "url",
    format: "json",
  };

  const exact = await fetchPageInfo(
    new URLSearchParams({ ...commonParams, titles: name, redirects: "1" })
  );
  if (exact) {
    return { url: exact.thumbnailUrl, source: exact.thumbnailUrl ? "wikipedia" : null, articleUrl: exact.articleUrl };
  }

  const fuzzy = await fetchPageInfo(
    new URLSearchParams({ ...commonParams, generator: "search", gsrsearch: name, gsrlimit: "1" })
  );
  if (fuzzy) {
    return { url: fuzzy.thumbnailUrl, source: fuzzy.thumbnailUrl ? "wikipedia" : null, articleUrl: fuzzy.articleUrl };
  }

  return null;
}

// Fallback-Link für eine Sehenswürdigkeit ohne Wikipedia-Artikel - immer
// verfügbar, damit "Mehr erfahren" nie ins Leere läuft.
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
