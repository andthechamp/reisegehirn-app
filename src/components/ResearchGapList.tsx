import { ALL_CATEGORIES, listOpenGaps, MAX_AUTO_ATTEMPTS, type ResearchGap } from "@/lib/research-gaps";
import { RESEARCH_AUTO } from "@/lib/research-config";

const SCOPE_LABEL: Record<ResearchGap["scope"], string> = {
  hafen: "Hafen",
  schiff: "Schiff",
  kabine: "Kabine",
};

const CATEGORY_LABEL: Record<string, string> = {
  anleger: "Anleger",
  zu_fuss: "Zu Fuß",
  essen: "Essen",
  praktisches: "Praktisches",
  sehenswuerdigkeiten: "Sehenswürdigkeiten",
  ausflug_offiziell: "Ausflüge (Reederei)",
  ausflug_privat: "Ausflüge (privat)",
  [ALL_CATEGORIES]: "alles",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Zeigt, welches Recherche-Wissen aktuell fehlt - die Gegenleistung dafür,
 * dass die App nicht mehr von sich aus (und ungefragt kostenpflichtig)
 * nachrecherchiert. Server-Komponente: die Liste ist reine Anzeige, es gibt
 * nichts zu klicken, und der Zugriff auf research_gaps läuft ohnehin nur über
 * den Service-Role-Client (siehe lib/research-gaps.ts).
 */
export default async function ResearchGapList() {
  const gaps = await listOpenGaps();

  if (gaps.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Keine offenen Lücken - für alle bisher aufgerufenen Häfen, Schiffe und Kabinenkategorien liegen Infos vor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        {RESEARCH_AUTO
          ? "Die automatische Recherche ist aktiv und arbeitet diese Liste im Hintergrund ab."
          : "Die automatische Recherche ist aus. Diese Themen füllst du per Seed-Skript oder mit „Jetzt recherchieren“ in der jeweiligen Reise."}
      </p>
      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {gaps.map((gap) => (
          <li key={gap.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                <span className="text-ink/40">{SCOPE_LABEL[gap.scope]}</span> {gap.subject}
                {gap.ship_name && <span className="text-ink/40"> · {gap.ship_name}</span>}
              </p>
              <p className="text-xs text-ink/50">
                Fehlt: {CATEGORY_LABEL[gap.category] ?? gap.category} · {gap.seen_count}× gebraucht · zuletzt{" "}
                {formatDate(gap.last_seen_at)}
              </p>
            </div>
            {gap.attempts > 0 && (
              <span
                className="shrink-0 text-xs text-ink/40"
                title={
                  gap.attempts >= MAX_AUTO_ATTEMPTS
                    ? "Versuchsobergrenze erreicht - die Automatik fasst dieses Thema nicht mehr an."
                    : undefined
                }
              >
                {gap.attempts}/{MAX_AUTO_ATTEMPTS} Versuche
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
