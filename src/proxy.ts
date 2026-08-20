import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Öffentlich erreichbar ohne Login. Alles andere (inkl. /, /trips/*, /admin,
// /api/*) verlangt eine gültige Session.
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Cron-Endpunkte laufen ohne Nutzer-Session (Vercel Cron ruft sie direkt
// auf) - die Auth-Prüfung übernimmt dort stattdessen CRON_SECRET, siehe
// src/app/api/cron/*/route.ts.
function isCronPath(pathname: string) {
  return pathname.startsWith("/api/cron/");
}

export async function proxy(request: NextRequest) {
  if (isCronPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() (nicht getSession()) validiert die Session gegen den
  // Auth-Server statt nur das lokale Cookie zu vertrauen - notwendig, um
  // abgelaufene/widerrufene Sessions zuverlässig zu erkennen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Auf alles anwenden außer:
     * - _next/static, _next/image (Next-interne Assets)
     * - favicon.ico
     * - Dateien mit Endung (Bilder, Fonts, Skripte etc.) - u. a. public/
     *   maplibre-gl-worker.mjs (siehe RouteMap.tsx): ein Worker lädt sein
     *   Skript ohne Session-Cookie, ohne diesen Ausschluss landet der
     *   Worker-Request im Login-Redirect statt im echten JS.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|mjs)$).*)",
  ],
};
