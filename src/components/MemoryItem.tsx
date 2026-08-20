"use client";

import { useState } from "react";
import MarkdownText from "@/components/MarkdownText";
import { ChevronDownIcon, StarIcon } from "@/components/icons";

// Vorschau, falls die Notiz eingeklappt ist - erster Satz oder erste Zeile,
// ohne Markdown-Formatierung, damit die Kürzung nicht mitten in einem
// **fett**-Tag abbricht.
const PREVIEW_LENGTH = 90;

function previewOf(content: string) {
  const firstLine = content.trim().split("\n")[0].replace(/\*\*/g, "");
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0];
  const text = firstSentence.length < 20 ? firstLine : firstSentence;
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH).trim() + " …" : text;
}

export default function MemoryItem({ content, onDelete }: { content: string; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-r-[14px] border-l-[3px] border-stamp bg-card">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-start gap-2 p-3 text-left">
        <StarIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stamp" />
        <div className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-ink/85">
          {expanded ? <MarkdownText text={content} /> : <p className="truncate">{previewOf(content)}</p>}
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          role="button"
          className="shrink-0 text-xs text-ink/40 hover:text-red-700"
        >
          Entfernen
        </span>
        <ChevronDownIcon
          className={"mt-0.5 h-4 w-4 shrink-0 text-ink/30 transition-transform " + (expanded ? "rotate-180" : "")}
        />
      </button>
    </li>
  );
}
