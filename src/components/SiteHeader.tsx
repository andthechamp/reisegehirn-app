import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import LogoutButton from "@/components/LogoutButton";

export default async function SiteHeader() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  return (
    <header className="border-b border-ink/10 bg-mist/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold text-fjord-dark hover:text-fjord">
          ⛵ Reisegehirn
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link href="/admin" className="text-sm text-ink/50 hover:text-ink">
                Admin
              </Link>
            )}
            <span className="text-sm text-ink/40">{user.email}</span>
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
