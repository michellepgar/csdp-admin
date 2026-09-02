import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { Sidebar } from "@/components/sidebar";
import { SidebarShell } from "@/components/sidebar-shell";

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

  return (
    <SidebarShell
      sidebar={<Sidebar currentName={me.name} schools={state.schools} isAdmin={isAdmin(me)} />}
      initialCollapsed={sidebarCollapsed}
    >
      {children}
    </SidebarShell>
  );
}
