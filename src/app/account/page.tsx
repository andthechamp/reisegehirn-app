import CloseButton from "@/components/CloseButton";
import ProfileForm from "@/components/ProfileForm";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { getSupabaseServerClient } from "@/lib/supabase";

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("email, full_name, chat_language").eq("id", user.id).single()
    : { data: null };

  return (
    <main className="mx-auto min-h-screen max-w-sm px-6 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Profil</h1>
        <CloseButton />
      </div>
      <ProfileForm
        initialEmail={profile?.email ?? ""}
        initialFullName={profile?.full_name ?? ""}
        initialChatLanguage={profile?.chat_language === "vi" ? "vi" : "de"}
      />

      <h2 className="mb-4 mt-10 font-display text-lg font-semibold text-ink">Passwort ändern</h2>
      <PasswordChangeForm />
    </main>
  );
}
