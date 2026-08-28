import type { TripContext } from "@/lib/trip-context";
import ResearchCard from "@/components/ResearchCard";

type RouteFinding = TripContext["route_research"][number];

const CATEGORY_LABEL: Record<string, string> = {
  praktisches: "Praktisches",
  insider_tipps: "Insider-Tipps",
  sonstiges: "Sonstiges",
};

interface RouteResearchProps {
  findings: RouteFinding[];
}

// Rein lesend, ohne "Jetzt recherchieren"-Button wie bei ShipResearch/
// PortResearch: route_research ist ausschließlich redaktionell/manuell
// gepflegt (siehe route-research.ts), es gibt keinen KI-Recherche-Pfad dafür.
export default function RouteResearch({ findings }: RouteResearchProps) {
  if (findings.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-medium text-ink">Tipps für diese Route</h2>
      <div className="space-y-2">
        {findings.map((f) => (
          <ResearchCard
            key={f.id}
            finding={{
              id: f.id,
              port_call_id: null,
              cabin_category: null,
              category: f.category,
              title: f.title,
              // "conditions" hat keine eigene UI-Fläche in ResearchCard - hier
              // als kursiver Hinweis vorangestellt statt content unverändert
              // zu lassen und die Einschränkung stillschweigend zu verlieren.
              content: f.conditions ? `(Gilt: ${f.conditions})\n\n${f.content}` : f.content,
              items: null,
              source_tier: f.source_tier,
              source_name: f.source_name,
              source_url: f.source_url,
              tier_note: null,
              staleness: f.staleness,
              shared: true,
            }}
            categoryLabel={CATEGORY_LABEL[f.category] ?? f.category}
            categoryTone="amber"
          />
        ))}
      </div>
    </section>
  );
}
