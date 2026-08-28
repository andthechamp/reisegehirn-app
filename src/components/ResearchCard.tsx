"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import FindingContent from "@/components/FindingContent";
import { ChevronDownIcon, iconForFinding } from "@/components/icons";

type Finding = TripContext["research"][number];

const SOURCE_TIER_LABEL: Record<string, string> = {
  "1": "offizielle Quelle",
  "2": "Fachportal",
  "3": "Forum/Blog",
};

interface ResearchCardProps {
  finding: Finding;
  categoryLabel?: string | null;
  categoryTone?: "fjord" | "amber";
  onDelete?: (id: string) => void;
}

export default function ResearchCard({
  finding: f,
  categoryLabel = null,
  categoryTone = "fjord",
  onDelete,
}: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconForFinding(f.category, f.title);

  const accent = categoryTone === "amber" ? "border-stamp text-stamp" : "border-sea text-sea";

  return (
    <div className={"rounded-r-[14px] border-l-[3px] bg-card shadow-sm " + accent.split(" ")[0]}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 py-3 pl-3 pr-3 text-left"
      >
        <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + accent.split(" ")[1]} />
        <div className="min-w-0 flex-1">
          {categoryLabel && (
            <p
              className={
                "font-mono text-[9.5px] font-bold uppercase tracking-[.16em] " +
                (categoryTone === "amber" ? "text-stamp-deep" : "text-sea")
              }
            >
              {categoryLabel}
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-ink">{f.title}</p>
            {onDelete && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(f.id);
                }}
                role="button"
                title="Als falsch/irrelevant entfernen"
                className="shrink-0 text-xs text-ink/30 hover:text-red-700"
              >
                Entfernen
              </span>
            )}
          </div>
        </div>
        <ChevronDownIcon
          className={"mt-0.5 h-4 w-4 shrink-0 text-ink/30 transition-transform " + (expanded ? "rotate-180" : "")}
        />
      </button>

      {expanded && (
        <div className="pb-3 pl-10 pr-3 text-[13.5px] leading-[1.55] text-ink/85">
          <FindingContent content={f.content} items={f.items} />

          {f.source_name && (
            <p className="mt-2 font-mono text-[10.5px] text-ink/45">
              Quelle:{" "}
              {f.source_url ? (
                <a href={f.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                  {f.source_name}
                </a>
              ) : (
                f.source_name
              )}{" "}
              ({SOURCE_TIER_LABEL[f.source_tier] ?? f.source_tier})
              {f.staleness === "verfällt" && " · kann veraltet sein"}
              {f.tier_note && ` · ${f.tier_note}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
