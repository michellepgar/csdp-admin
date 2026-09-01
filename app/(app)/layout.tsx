import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, findVaByEmail, isAdmin } from "@/lib/app-state";
import { Sidebar } from "@/components/sidebar";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar currentName={me.name} schoolNames={state.schools.map((s) => s.name)} isAdmin={isAdmin(me)} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
