import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Va } from "@/lib/app-state";

/* Lightweight alternative to fetchAppState() for Server Actions that
   only need to confirm "is this a signed-in team member" and get
   their own Va record -- most add/update/remove actions never touch
   any other slice of app state. Replacing fetchAppState() (a ~19-table
   Promise.all) with a single vas lookup here is the single biggest
   win for "saving feels slow": every action that used to pay for the
   entire app's data on every submit now only pays for what it
   actually reads.

   Actions that genuinely need other state (e.g. checking an existing
   record's owner before allowing delete, or a school's vaAssigned for
   a permission check) should query just that table/row directly
   instead -- not reach for the full fetchAppState() either, though
   that refactor is broader and not done everywhere yet. */
export async function requireTeamMember() {
  // The demo user has no real Supabase session backing it (see
  // lib/demo-app-state.ts's own comment), so every write action would
  // otherwise fail here with a generic "Not signed in" -- true, but
  // confusing for someone clicking around a demo. Every Server Action
  // ultimately calls this one helper (or requireAdmin() in
  // app/(app)/team/actions.ts, which itself calls this), so guarding
  // here covers all of them from one place.
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";
  if (isDemo) throw new Error("This is a demo account — changes aren't saved. Sign up for a real account to make changes.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const { data: vaRow } = await supabase
    .from("vas")
    .select("id, name, email, admin, role, color")
    .ilike("email", user.email)
    .maybeSingle();
  if (!vaRow) throw new Error("Not on the team list");

  const me: Va = {
    id: vaRow.id,
    name: vaRow.name,
    email: vaRow.email ?? undefined,
    admin: vaRow.admin ?? undefined,
    role: vaRow.role ?? undefined,
    color: vaRow.color ?? undefined,
  };

  return { supabase, me };
}
