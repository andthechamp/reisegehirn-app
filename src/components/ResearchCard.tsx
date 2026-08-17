"use client";

import { useState } from "react";
import type { TripContext } from "@/lib/trip-context";
import FindingContent from "@/components/FindingContent";
import { ChevronDownIcon, iconForFinding } from "@/components/icons";

type Finding = TripContext["research"][number];

const SOURCE_TIER_LABEL: Record<string, string> = {
  A: "offizielle Quelle",
  B: "Portal",
  C: "Forum/Blog",
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

  return (
    <div className="rounded-r-lg border-l-[3px] border-fjord bg-white shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 py-3 pl-3 pr-3 text-left"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fjord" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium text-ink">{f.title}</p>
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
        <div className="pb-3 pl-10 pr-3">
          <FindingContent content={f.content} items={f.items} />

          {(categoryLabel || f.source_name) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {categoryLabel && (
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs " +
                    (categoryTone === "amber" ? "bg-amber-light text-amber" : "bg-fjord-light text-fjord-dark")
                  }
                >
                  {categoryLabel}
                </span>
              )}
              {f.source_name && (
                <span className="rounded-full bg-fjord-light px-2 py-0.5 text-xs text-fjord-dark">
                  {f.source_url ? (
                    <a href={f.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                      {f.source_name}
                    </a>
                  ) : (
                    f.source_name
                  )}
                </span>
              )}
              {f.source_name && (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/50">
                  {SOURCE_TIER_LABEL[f.source_tier] ?? f.source_tier}
                </span>
              )}
              {f.staleness === "verfällt" && <span className="text-xs text-ink/40">kann veraltet sein</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
