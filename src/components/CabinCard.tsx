import type { TripContext } from "@/lib/trip-context";

type Booking = TripContext["bookings"][number];
type Traveler = TripContext["travelers"][number];

// Vorname + Nachname-Initiale (z. B. "Marc Andre Faber" -> "MF"), da der
// mittlere Name bei mehrteiligen Vornamen sonst den Kreis dominieren würde.
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CabinCard({ booking, travelers }: { booking: Booking; travelers: Traveler[] }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <p className="font-medium text-ink">{booking.cabin_number ?? "unbekannt"}</p>
      <p className="text-xs text-ink/50">{booking.cabin_type ?? "Typ unbekannt"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {travelers.map((t) => (
          <span
            key={t.id}
            title={t.name}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-fjord-light text-xs font-medium text-fjord-dark"
          >
            {initialsFor(t.name)}
          </span>
        ))}
        {travelers.length === 0 && <span className="text-xs text-ink/40">Keine Reisenden zugeordnet</span>}
      </div>
    </div>
  );
}
