import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { SidebarShell } from "@/components/sidebar-shell";
import { addSchool } from "./layout-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Demo mode has no real Supabase session for is_team_member() to check
  // against -- it would just fail RLS and land here as "not on the team",
  // so skip it entirely for the fake demo user (see getCurrentUser()'s and
  // fetchAppState()'s own demo-mode checks, which this same cookie drives).
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";

  /* getCurrentUser(), the is_team_member() RPC, and fetchAppState()'s
     own ~25-query Promise.all each only depend on the request's
     already-present session cookie, not on each other's return values
     -- they used to run one after another (three full network round
     trips stacked up, on EVERY navigation, since this layout re-runs
     server-side for every page in the (app) group). Firing them
     together cuts that to about one round trip's worth of latency.
     The membership check is still evaluated (and redirected on)
     before `state` is ever read below, so behavior is unchanged --
     the only wasted work in the rare non-member/logged-out case is
     fetchAppState()'s queries running and being discarded, which RLS
     makes cheap (empty results) anyway. */
  const [user, isMember, state] = await Promise.all([
    getCurrentUser(),
    isDemo ? Promise.resolve(true) : createClient().then((supabase) => supabase.rpc("is_team_member")).then((r) => r.data),
    fetchAppState(),
  ]);

  if (!user || !user.email) redirect("/login");

  /* Checked via the same is_team_member() every table's RLS uses --
     every one of those ~25 queries is RLS-gated on team membership,
     and app_state's in particular uses .single(), which errors the
     instant RLS hides its one row (as every query does for a
     non-member). That used to make fetchAppState() return null before
     the findVaByEmail check below ever ran, so a freshly-added-but-
     not-yet-synced or removed test account saw the generic "Couldn't
     load the app" fallback instead of this page's actual "you're not
     on the team" message (see supabase/phase14_fix_app_state_rls.sql's
     comment for the incident this was found from). Checking it here,
     independently of `state`, keeps the two cases distinguishable:
     not on the team is expected and gets a clear page; anything else
     failing is a real problem. */
  if (!isDemo && !isMember) redirect("/not-on-team");

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>
      </div>
    );
  }

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const sidebarCollapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";

  const schoolVaAssigned: Record<string, string> = {};
  for (const schoolId of Object.keys(state.schoolData)) {
    const va = state.schoolData[schoolId]?.vaAssigned;
    if (va) schoolVaAssigned[schoolId] = va;
  }

  return (
    <SidebarShell
      currentName={me.name}
      schools={state.schools}
      isAdmin={isAdmin(me)}
      vas={state.vas}
      schoolVaAssigned={schoolVaAssigned}
      addSchool={addSchool}
      initialCollapsed={sidebarCollapsed}
    >
      {children}
    </SidebarShell>
  );
}
