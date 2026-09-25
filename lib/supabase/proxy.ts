import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicAuthRoute } from "@/lib/auth-routes";

/* Named to match Next.js 16's "Proxy" convention (the file that used to be
   called middleware.ts/middleware() is now proxy.ts/proxy() — same
   behavior, renamed to avoid confusion with Express-style middleware). */
export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() checks the sign-in token's signature right here when the
  // project signs tokens with its public keys, instead of a round trip to
  // Supabase's sign-in server on every page change (it falls back to that
  // round trip on its own for older, shared-secret tokens). It still
  // refreshes an expiring session, like getUser() did.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  // The login page's "See a demo" link sets this cookie instead of a real
  // Supabase session -- treated as "signed in" here too, or every demo
  // page load would bounce straight back to /login. See
  // lib/demo-app-state.ts's own comment for the rest of this path.
  const isDemo = request.cookies.get("demo-mode")?.value === "1";

  const isPublicRoute = isPublicAuthRoute(request.nextUrl.pathname);
  const isLoginRoute = request.nextUrl.pathname === "/login";

  if (!user && !isDemo && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if ((user || isDemo) && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  return response;
}
