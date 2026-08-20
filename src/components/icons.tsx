// Kleine, einheitliche Icon-Sammlung für Recherche-Karten - bewusst kein
// externes Icon-Paket, nur die paar Symbole, die die App tatsächlich braucht.

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function AnchorIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      <path d="M8 12H2m14 0h6" />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function CompassIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 8-4 8-4-4 8-4Z" />
    </svg>
  );
}

export function FootprintsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <ellipse cx="8" cy="7" rx="2.5" ry="3.5" />
      <ellipse cx="16" cy="15" rx="2.5" ry="3.5" />
      <path d="M8 12v2m8-11v2" />
    </svg>
  );
}

export function UtensilsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2M8 13v9" />
      <path d="M17 2c-1.5 0-3 2-3 6s1.5 6 3 6v7" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2Z" />
    </svg>
  );
}

export function CloudIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2A4 4 0 0 0 6.5 19h11Z" />
    </svg>
  );
}

export function DotIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg className={"animate-spin " + (className ?? "")} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const CATEGORY_ICON: Record<string, (props: IconProps) => React.ReactElement> = {
  schiffswissen: AnchorIcon,
  insider_tipps: ChatIcon,
  anleger: AnchorIcon,
  ausflug_offiziell: CompassIcon,
  ausflug_privat: CompassIcon,
  zu_fuss: FootprintsIcon,
  essen: UtensilsIcon,
  praktisches: InfoIcon,
  sehenswuerdigkeiten: StarIcon,
  wetter_packen: CloudIcon,
  sonstiges: DotIcon,
};

/** Wählt das passende Icon für einen Recherche-Fund - Decksplan bekommt
 * bewusst ein eigenes Icon statt des generischen Anker für "schiffswissen". */
export function iconForFinding(category: string, title: string) {
  if (category === "schiffswissen" && /decksplan/i.test(title)) return LayersIcon;
  return CATEGORY_ICON[category] ?? DotIcon;
}
