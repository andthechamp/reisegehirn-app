import { splitNumberedList, splitBulletList, splitSentences } from "@/lib/format-list";
import { googleSearchUrl, resolveDisplayImageUrl } from "@/lib/wikimedia";
import type { SightItem } from "@/lib/research-schema";

// Ab dieser Länge wirkt ein einzelner Absatz als dichter Textblock - erst
// dann lohnt sich die Auftrennung in einzelne Sätze.
const LONG_PARAGRAPH_THRESHOLD = 180;

interface FindingContentProps {
  content: string;
  // Nur bei category "sehenswuerdigkeiten" gesetzt - maßgebliche Fassung,
  // unabhängig vom Text-Parsing von content (siehe buildPortResearchPrompt).
  items?: SightItem[] | null;
}

// Manche Bullet-Punkte folgen dem Muster "Name – Beschreibung" (z. B.
// Restaurant-/Bar-Listen: "Surf & Turf – Steaks & Grill (Deck 5)"). Der Name
// vor dem ersten Gedankenstrich wird hervorgehoben, damit lange Listen beim
// Überfliegen schneller lesbar sind - ohne Gedankenstrich (die meisten
// anderen Recherche-Kategorien) bleibt es ein normaler Listenpunkt.
function BulletItem({ text }: { text: string }) {
  const match = text.match(/^(.{1,40}?)\s+–\s+(.+)$/);
  if (!match) return <>{text}</>;
  const [, name, rest] = match;
  return (
    <>
      <span className="font-medium text-ink">{name}</span> – {rest}
    </>
  );
}

export default function FindingContent({ content, items }: FindingContentProps) {
  if (items && items.length > 0) {
    return (
      <ol className="mt-1 list-none space-y-3 pl-0 text-sm leading-relaxed text-ink/80">
        {items.map((item, i) => {
          const thumbUrl = item.image_url ? resolveDisplayImageUrl(item.image_url) : null;
          // Ältere, vor dieser Umstellung gespeicherte Einträge kennen
          // article_url noch nicht (undefined) - dann hier client-seitig auf
          // die Google-Suche ausweichen, damit "Mehr erfahren" nie fehlt.
          const moreInfoUrl = item.article_url ?? googleSearchUrl(item.name);
          return (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 font-medium text-fjord">{i + 1}.</span>
              <a
                href={moreInfoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 gap-3 rounded-lg transition hover:bg-fjord-light/40"
                title={`Mehr erfahren: ${item.name}`}
              >
                {thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl}
                    alt={item.name}
                    title={item.attribution ? `Foto: ${item.attribution}` : undefined}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-lg object-cover bg-ink/5"
                  />
                )}
                <span className="flex-1">
                  <span className="font-medium text-ink underline decoration-ink/20 underline-offset-2">
                    {item.name}
                  </span>
                  {item.description && <>: {item.description}</>}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    );
  }

  const numbered = splitNumberedList(content);
  if (numbered) {
    return (
      <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80">
        {numbered.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }

  const bulleted = splitBulletList(content);
  if (bulleted) {
    // Ab einer gewissen Länge (z. B. Restaurant-/Bar-Listen mit 8+ Punkten)
    // wirkt eine einspaltige Liste unnötig lang - ab Tablet-Breite dann in
    // zwei CSS-Spalten fließen lassen, damit die Karte kompakter bleibt.
    const dense = bulleted.length > 6;
    return (
      <ul
        className={
          "mt-1 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80" +
          (dense ? " sm:columns-2 sm:gap-x-6 sm:space-y-1" : "")
        }
      >
        {bulleted.map((item, i) => (
          <li key={i} className={dense ? "break-inside-avoid" : undefined}>
            <BulletItem text={item} />
          </li>
        ))}
      </ul>
    );
  }

  const sentences = content.length > LONG_PARAGRAPH_THRESHOLD ? splitSentences(content) : null;
  if (sentences) {
    return (
      <div className="mt-1 space-y-1.5 text-sm leading-relaxed text-ink/80">
        {sentences.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </div>
    );
  }

  return <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{content}</p>;
}
