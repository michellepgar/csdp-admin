"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, computeEodTotalHours, type AppState } from "@/lib/app-state";

async function requireUserAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me) throw new Error("Not on the team list");

  return { supabase, state, me };
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

export async function addEodReport(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const date = (formData.get("date") as string) || "";
  if (!date) return;
  const timeIn = (formData.get("timeIn") as string) || "";
  const timeOut = (formData.get("timeOut") as string) || "";
  const breakStart = (formData.get("breakStart") as string) || "";
  const breakEnd = (formData.get("breakEnd") as string) || "";
  const tasksRaw = (formData.get("tasks") as string) || "";
  const tasks = tasksRaw.split("\n").map((s) => s.trim()).filter(Boolean);

  state.eodReports = state.eodReports || [];
  state.eodReports.push({
    id: crypto.randomUUID(),
    author: me.name,
    date,
    timeIn,
    timeOut,
    breakStart,
    breakEnd,
    totalHours: computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd),
    tasks,
    createdAt: new Date().toISOString(),
  });
  await saveState(supabase, state);
  revalidatePath("/eod");
}
