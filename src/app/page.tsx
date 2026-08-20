import Link from "next/link";
import TripList from "@/components/TripList";
import { lookupWikipediaImage } from "@/lib/wikimedia";

export default async function Home() {
  // Gleiches Platzhalter-Foto wie der Login-Hero (AuthForm.tsx) - sorgt für
  // ein durchgängiges Gefühl zwischen Anmelden und Startseite, siehe
  // design_handoff_reisegehirn_mobile/README.md.
  const hero = await lookupWikipediaImage("Geirangerfjord", 1200);

  return (
    <main className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#7a6552] via-[#4a3f34] to-logbook text-[#F7F1E6]">
        {hero?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(35,32,27,.5) 0%, rgba(35,32,27,.15) 45%, rgba(35,32,27,.88) 100%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[260px] max-w-2xl flex-col justify-end px-6 pb-8 pt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.18em] text-[#F7F1E6]/70">Logbuch</p>
              <h1 className="mt-1 font-display text-4xl italic leading-tight">Deine Reisen</h1>
            </div>
            <Link
              href="/trips/new"
              className="flex h-[42px] shrink-0 items-center justify-center rounded-full bg-stamp px-4 text-sm font-medium text-[#FDF8F0] transition hover:bg-stamp-deep"
            >
              + Neue Reise
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <TripList />
      </div>
    </main>
  );
}
