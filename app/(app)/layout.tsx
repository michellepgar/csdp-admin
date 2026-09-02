import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { SidebarShell } from "@/components/sidebar-shell";
import { addSchool } from "./layout-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

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

  const groupNames = Array.from(
    new Set([
      ...(state.contactGroups || []).map((g) => g.name),
      ...(state.distributionGroups || []).map((g) => g.name),
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <SidebarShell
      currentName={me.name}
      schools={state.schools}
      isAdmin={isAdmin(me)}
      vas={state.vas}
      schoolVaAssigned={schoolVaAssigned}
      addSchool={addSchool}
      groupNames={groupNames}
      initialCollapsed={sidebarCollapsed}
    >
      {children}
    </SidebarShell>
  );
}
