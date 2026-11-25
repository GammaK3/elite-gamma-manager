import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse
) {
  const response = NextResponse.redirect(url);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(header);

    if (value) {
      response.headers.set(header, value);
    }
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims ?? null;

  // Obtener la ruta actual. Solo se declara una vez.
  const pathname = request.nextUrl.pathname;

  const publicPaths = [
    "/login",
    "/forgot-password",
    "/set-password",
    "/auth/confirm",
    "/auth/callback",
  ];

  // Proteger las rutas privadas.
  if (!claims && !publicPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    return redirectWithCookies(url, supabaseResponse);
  }

  // Evitar que usuarios autenticados vuelvan al login.
  if (claims && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
