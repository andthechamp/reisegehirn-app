import ProfileForm from "@/components/ProfileForm";
import { getSupabaseServerClient } from "@/lib/supabase";

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("email, full_name").eq("id", user.id).single()
    : { data: null };

  return (
    <main className="mx-auto min-h-screen max-w-sm px-6 py-16">
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink">Profil</h1>
      <ProfileForm initialEmail={profile?.email ?? ""} initialFullName={profile?.full_name ?? ""} />
    </main>
  );
}
