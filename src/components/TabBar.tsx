"use client";

import { AnchorIcon, CompassIcon, FootprintsIcon, ChatIcon } from "@/components/icons";

export type TripTab = "reise" | "tage" | "ausfluege" | "chat";

const TABS: { id: TripTab; label: string; icon: (p: { className?: string }) => React.ReactElement }[] = [
  { id: "reise", label: "Reise", icon: AnchorIcon },
  { id: "tage", label: "Tage", icon: CompassIcon },
  { id: "ausfluege", label: "Ausflüge", icon: FootprintsIcon },
  { id: "chat", label: "Chat", icon: ChatIcon },
];

// Höhe 82px, Glas-Effekt über blur(12px) - siehe
// design_handoff_reisegehirn_mobile/README.md, Abschnitt "Reiseseite".
export default function TabBar({ active, onChange }: { active: TripTab; onChange: (tab: TripTab) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[82px] items-stretch border-t border-logbook/12 bg-paper/94 backdrop-blur-[12px]"
      aria-label="Reise-Navigation"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 pb-1 text-[10px] ${
              isActive ? "text-stamp" : "text-logbook/42"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-[22px] w-[22px]" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
