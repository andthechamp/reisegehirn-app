"use client";

import Link from "next/link";

interface SuccessStepProps {
  tripId: string;
  onNewTrip: () => void;
}

export default function SuccessStep({ tripId, onNewTrip }: SuccessStepProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stamp-tint">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-stamp" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h1 className="font-display text-3xl italic text-ink">Reise gespeichert</h1>
        <p className="mt-2 text-ink/70">
          Reise-ID <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs">{tripId}</code> liegt
          jetzt im Reisegehirn. Als Nächstes: recherchierte Hafeninformationen ergänzen.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <button
          onClick={onNewTrip}
          className="rounded-[14px] border border-ink/20 px-6 py-3 font-medium text-ink/70 transition hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:ring-offset-2"
        >
          Weitere Reise anlegen
        </button>
        <Link
          href={`/trips/${tripId}`}
          className="rounded-[14px] bg-stamp px-6 py-3 font-medium text-[#FDF8F0] transition hover:bg-stamp-deep focus:outline-none focus:ring-2 focus:ring-stamp focus:ring-offset-2"
        >
          Fragen zu dieser Reise stellen
        </Link>
      </div>
    </div>
  );
}
