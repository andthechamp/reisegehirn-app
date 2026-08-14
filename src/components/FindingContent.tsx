import { splitNumberedList, splitBulletList, splitSentences } from "@/lib/format-list";

// Ab dieser Länge wirkt ein einzelner Absatz als dichter Textblock - erst
// dann lohnt sich die Auftrennung in einzelne Sätze.
const LONG_PARAGRAPH_THRESHOLD = 180;

export default function FindingContent({ content }: { content: string }) {
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
    return (
      <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80">
        {bulleted.map((item, i) => (
          <li key={i}>{item}</li>
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
