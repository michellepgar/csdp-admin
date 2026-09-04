import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { DEMO_USER_EMAIL } from "@/lib/demo-app-state";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render — proxy.ts
            // (Task 4) is what actually refreshes the session cookie in
            // that case, so this can be safely ignored here.
          }
        },
      },
    }
  );
}

/* Same dedup reasoning as fetchAppState() in lib/app-state.ts — the
   layout and the page it renders both need to know who's logged in;
   this shares one actual call to Supabase per request instead of two.

   The login page's "See a demo" link sets a demo-mode cookie instead
   of creating a real Supabase session -- checked first here (before
   ever touching Supabase) so every caller of getCurrentUser() sees a
   fake "Jane" user without needing its own separate demo branch. See
   lib/demo-app-state.ts's own comment for the rest of this path
   (fetchAppState(), the (app) layout's is_team_member() check, and
   proxy.ts's own redirect all need the same bypass). */
export const getCurrentUser = cache(async () => {
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";
  if (isDemo) return { email: DEMO_USER_EMAIL } as User;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
