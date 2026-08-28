import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { lookupWikipediaImage } from "@/lib/wikimedia";

export default async function LoginPage() {
  // Mangels Trip-Kontext vor dem Login ein fester Platzhalter, wie im
  // Prototyp-Handoff (design_handoff_reisegehirn_mobile/README.md, Abschnitt
  // "Assets": Motive Geiranger/Geirangerfjord).
  const hero = await lookupWikipediaImage("Geirangerfjord", 1200);

  return (
    <main className="mx-auto max-w-sm px-6 pt-12 lg:max-w-none lg:px-0 lg:pt-0">
      <Suspense>
        <AuthForm mode="login" heroImageUrl={hero?.url ?? null} />
      </Suspense>
    </main>
  );
}
