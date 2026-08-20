"use client";

import { useState } from "react";
import UploadStep from "@/components/UploadStep";
import ReviewStep from "@/components/ReviewStep";
import SuccessStep from "@/components/SuccessStep";
import type { ExtractionResult } from "@/lib/extraction-schema";

type Step =
  | { name: "upload" }
  | { name: "review"; data: ExtractionResult }
  | { name: "success"; tripId: string };

export default function NewTripPage() {
  const [step, setStep] = useState<Step>({ name: "upload" });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-ink/40">
        <span className={step.name === "upload" ? "font-bold text-stamp" : ""}>1. Hochladen</span>
        <span className="text-ink/25">→</span>
        <span className={step.name === "review" ? "font-bold text-stamp" : ""}>2. Prüfen</span>
        <span className="text-ink/25">→</span>
        <span className={step.name === "success" ? "font-bold text-stamp" : ""}>3. Fertig</span>
      </div>

      {step.name === "upload" && (
        <UploadStep onExtracted={(result) => setStep({ name: "review", data: result as ExtractionResult })} />
      )}

      {step.name === "review" && (
        <ReviewStep
          initial={step.data}
          onBack={() => setStep({ name: "upload" })}
          onConfirmed={(tripId) => setStep({ name: "success", tripId })}
        />
      )}

      {step.name === "success" && (
        <SuccessStep tripId={step.tripId} onNewTrip={() => setStep({ name: "upload" })} />
      )}
    </main>
  );
}
