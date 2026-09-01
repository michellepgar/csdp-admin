import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Va {
  id: string;
  name: string;
  email?: string;
  admin?: boolean;
  role?: string;
  color?: string;
}

export interface School {
  id: string;
  name: string;
}

export interface ChecklistProgressEntry {
  status: string;
}

export interface SchoolDataEntry {
  vaAssigned: string;
}

export interface AppState {
  schools: School[];
  vas: Va[];
  schoolData: Record<string, SchoolDataEntry>;
  checklistTemplate: { id: string }[];
  checklistProgress: Record<string, ChecklistProgressEntry>;
  communicationEditor?: string;
}

/* Wrapped in React's cache() so the layout and the page it's rendering
   (both of which need the same data) share one actual network call
   per request, instead of two — this was making every action feel
   slower than it needed to, since the layout fetches this on every
   navigation on top of whatever the page itself fetches. Note this only
   dedupes within a single request/render pass, not across a Server
   Action call and the page re-render that follows it — those are
   genuinely separate requests. */
export const fetchAppState = cache(async (): Promise<AppState | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", 1)
    .single();

  if (error || !data) return null;
  return data.data as AppState;
});

export function findVaByEmail(state: AppState, email: string): Va | undefined {
  const lower = email.toLowerCase();
  return state.vas.find((v) => (v.email || "").toLowerCase() === lower);
}

/* Same rule as the HTML app's isSuperAdmin(): Michelle by name, or anyone
   flagged admin/owner. Not a database-enforced role — same app-level-only
   gating the HTML app has always used (the shared RLS policy already lets
   any allowlisted team member write app_state; this is about which UI
   actions are offered and re-checked, not a stricter DB permission). */
export const SUPERADMIN_NAME = "Michelle";
export function isAdmin(va: Va): boolean {
  if (va.name === SUPERADMIN_NAME) return true;
  return !!(va.admin || va.role === "owner");
}

/* Same percentage the HTML app's Overview page shows: how much of the
   shared checklist template each school has marked "Done" for. */
export function checklistCompletion(state: AppState, schoolId: string): number {
  const tmpl = state.checklistTemplate || [];
  if (!tmpl.length) return 0;
  let done = 0;
  for (const item of tmpl) {
    const entry = state.checklistProgress[`${schoolId}:${item.id}`];
    if (entry && entry.status === "Done") done++;
  }
  return Math.round((done / tmpl.length) * 100);
}
