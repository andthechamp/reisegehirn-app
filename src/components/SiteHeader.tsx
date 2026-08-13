import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import LogoutButton from "@/components/LogoutButton";

export default async function SiteHeader() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let displayName = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
    displayName = profile?.full_name || user.email || "";
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
            <Link href="/account" className="text-sm text-ink/40 hover:text-ink">
              {displayName}
            </Link>
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
