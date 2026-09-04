import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The login page's "See a demo" link sets this cookie instead of a real
  // Supabase session -- treated as "signed in" here too, or every demo
  // page load would bounce straight back to /login. See
  // lib/demo-app-state.ts's own comment for the rest of this path.
  const isDemo = request.cookies.get("demo-mode")?.value === "1";

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isDemo && !isLoginRoute) {
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
