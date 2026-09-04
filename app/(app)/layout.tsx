import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { SidebarShell } from "@/components/sidebar-shell";
import { addSchool } from "./layout-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  /* Checked via the same is_team_member() every table's RLS uses,
     BEFORE fetchAppState()'s big Promise.all runs -- every one of
     those ~25 queries is RLS-gated on team membership, and app_state's
     in particular uses .single(), which errors the instant RLS hides
     its one row (as every query does for a non-member). That used to
     make fetchAppState() return null before the findVaByEmail check
     below ever ran, so a freshly-added-but-not-yet-synced or removed
     test account saw the generic "Couldn't load the app" fallback
     instead of this page's actual "you're not on the team" message
     (see supabase/phase14_fix_app_state_rls.sql's comment for the
     incident this was found from). Checking membership first, and
     independently of that Promise.all, makes the two cases
     distinguishable again: not on the team is expected and gets a
     clear page; anything else failing is a real problem. */
  // Demo mode has no real Supabase session for is_team_member() to check
  // against -- it would just fail RLS and land here as "not on the team",
  // so skip it entirely for the fake demo user (see getCurrentUser()'s and
  // fetchAppState()'s own demo-mode checks, which this same cookie drives).
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";
  if (!isDemo) {
    const supabase = await createClient();
    const { data: isMember } = await supabase.rpc("is_team_member");
    if (!isMember) redirect("/not-on-team");
  }

  const state = await fetchAppState();
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
