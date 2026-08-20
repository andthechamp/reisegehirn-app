import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { lookupWikipediaImage } from "@/lib/wikimedia";

export default async function SignupPage() {
  const hero = await lookupWikipediaImage("Geirangerfjord", 1200);

  return (
    <main className="mx-auto max-w-sm px-6 pt-12">
      <Suspense>
        <AuthForm mode="signup" heroImageUrl={hero?.url ?? null} />
      </Suspense>
    </main>
  );
}
