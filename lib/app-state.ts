import { createClient } from "@/lib/supabase/server";

export interface Va {
  id: string;
  name: string;
  email?: string;
  admin?: boolean;
  role?: string;
}

export interface School {
  id: string;
  name: string;
}

export interface ChecklistProgressEntry {
  status: string;
}

export interface AppState {
  schools: School[];
  vas: Va[];
  schoolData: Record<string, unknown>;
  checklistTemplate: { id: string }[];
  checklistProgress: Record<string, ChecklistProgressEntry>;
}

export async function fetchAppState(): Promise<AppState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", 1)
    .single();

  if (error || !data) return null;
  return data.data as AppState;
}

export function findVaByEmail(state: AppState, email: string): Va | undefined {
  const lower = email.toLowerCase();
  return state.vas.find((v) => (v.email || "").toLowerCase() === lower);
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
