import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="mx-auto min-h-screen max-w-sm px-6 py-16">
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink">Konto anlegen</h1>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
