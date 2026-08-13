"use client";

import Link from "next/link";

interface SuccessStepProps {
  tripId: string;
  onNewTrip: () => void;
}

export default function SuccessStep({ tripId, onNewTrip }: SuccessStepProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-fjord-light">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-fjord" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Reise gespeichert</h1>
        <p className="mt-2 text-ink/70">
          Reise-ID <code className="rounded bg-ink/5 px-1.5 py-0.5 text-sm">{tripId}</code> liegt jetzt
          im Reisegehirn. Als Nächstes: recherchierte Hafeninformationen ergänzen.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <button
          onClick={onNewTrip}
          className="rounded-xl border border-ink/20 px-6 py-3 font-medium text-ink/70 transition hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:ring-offset-2"
        >
          Weitere Reise anlegen
        </button>
        <Link
          href={`/trips/${tripId}`}
          className="rounded-xl bg-fjord px-6 py-3 font-medium text-white transition hover:bg-fjord-dark focus:outline-none focus:ring-2 focus:ring-fjord focus:ring-offset-2"
        >
          Fragen zu dieser Reise stellen
        </Link>
      </div>
    </div>
  );
}
