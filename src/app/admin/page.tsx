import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import UserTable from "@/components/UserTable";

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink">Nutzerverwaltung</h1>
      <UserTable currentUserId={user.id} />
    </main>
  );
}
