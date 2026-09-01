"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, type AppState } from "@/lib/app-state";

async function requireAdminAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) throw new Error("Not authorized");

  return { supabase, state };
}

async function saveState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: AppState
) {
  const { error } = await supabase
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function restoreBackup(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESTORE") return;

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return;
  }
  /* Minimal sanity check — a real backup always has a vas array. Not a
     full schema validation, just enough to refuse an obviously-wrong
     file (a random JSON export, an empty object) before overwriting
     everything. */
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as AppState).vas)) return;

  await saveState(supabase, parsed as AppState);
  revalidatePath("/", "layout");
}

export async function resetAllTasks(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESET") return;

  Object.values(state.schoolData || {}).forEach((sd) => {
    sd.tasks = [];
  });
  state.checklistProgress = {};

  await saveState(supabase, state);
  revalidatePath("/", "layout");
}
