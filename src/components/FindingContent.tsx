import { splitNumberedList, splitBulletList } from "@/lib/format-list";

export default function FindingContent({ content }: { content: string }) {
  const numbered = splitNumberedList(content);
  if (numbered) {
    return (
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink/80">
        {numbered.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }

  const bulleted = splitBulletList(content);
  if (bulleted) {
    return (
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/80">
        {bulleted.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  return <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{content}</p>;
}
