// Leichtgewichtige Markdown-Anzeige ohne externe Abhängigkeit - deckt genau
// das ab, was Chat-Antworten typischerweise nutzen: Absätze, Zeilenumbrüche,
// **fett** und "- "-Aufzählungen. Kein voller Markdown-Parser.

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");

        // Bei Websuche mit vielen Zitationen kann Modelltext in Fragmente
        // zerfallen, die nach dem Trennen an Leerzeilen nur noch aus einem
        // Satzzeichen bestehen (z. B. ". "). So einen inhaltsleeren Block
        // nicht als eigene, scheinbar leere Zeile rendern.
        const hasContent = lines.some((l) => /[\p{L}\p{N}]/u.test(l));
        if (!hasContent) return null;

        const isList = lines.length > 0 && lines.every((l) => /^[-•*]\s+/.test(l.trim()));

        if (isList) {
          return (
            <ul key={bi} className={"list-disc space-y-1 pl-5" + (bi > 0 ? " mt-2" : "")}>
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().replace(/^[-•*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi} className={bi > 0 ? "mt-2" : undefined}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
