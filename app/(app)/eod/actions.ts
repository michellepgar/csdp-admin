"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, computeEodTotalHours } from "@/lib/app-state";

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

  return { supabase, me };
}

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addEodReport(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  const date = (formData.get("date") as string) || "";
  if (!date) return;
  const timeIn = (formData.get("timeIn") as string) || "";
  const timeOut = (formData.get("timeOut") as string) || "";
  const breakStart = (formData.get("breakStart") as string) || "";
  const breakEnd = (formData.get("breakEnd") as string) || "";
  const tasksRaw = (formData.get("tasks") as string) || "";
  const tasks = tasksRaw.split("\n").map((s) => s.trim()).filter(Boolean);

  const { error } = await supabase.from("eod_reports").insert({
    id: crypto.randomUUID(),
    author: me.name,
    date,
    time_in: timeIn || null,
    break_start: breakStart || null,
    break_end: breakEnd || null,
    time_out: timeOut || null,
    total_hours: computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd) || null,
    tasks,
  });
  orThrow(error);
  revalidatePath("/eod");
}
