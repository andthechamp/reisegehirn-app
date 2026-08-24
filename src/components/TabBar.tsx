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
// Ab lg wird daraus eine linke Sidebar-Nav statt der fixed Bottom-Bar - siehe
// design_handoff_reisegehirn_mobile/README.md ist mobile-only, Desktop war zum
// Handoff-Zeitpunkt noch nicht spezifiziert.
export default function TabBar({ active, onChange }: { active: TripTab; onChange: (tab: TripTab) => void }) {
  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-[82px] items-stretch border-t border-logbook/12 bg-paper/94 backdrop-blur-[12px] lg:hidden"
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

      <nav
        className="sticky top-6 hidden w-[168px] shrink-0 flex-col gap-1 lg:flex"
        aria-label="Reise-Navigation"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition ${
                isActive ? "bg-stamp/10 font-medium text-stamp" : "text-logbook/55 hover:bg-paper-deep hover:text-logbook"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-[20px] w-[20px] shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
