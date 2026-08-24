import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import UserTable from "@/components/UserTable";
import InviteList from "@/components/InviteList";
import ResearchGapList from "@/components/ResearchGapList";

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-10 px-6 py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <h1 className="font-display mb-6 text-2xl font-semibold text-ink">Nutzerverwaltung</h1>
          <UserTable currentUserId={user.id} />
        </div>
        <div>
          <h2 className="font-display mb-6 text-2xl font-semibold text-ink">Registrierung freischalten</h2>
          <InviteList />
        </div>
      </div>
      <div>
        <h2 className="font-display mb-6 text-2xl font-semibold text-ink">Recherche-Lücken</h2>
        <ResearchGapList />
      </div>
    </main>
  );
}
