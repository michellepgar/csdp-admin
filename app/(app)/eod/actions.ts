"use server";

import { revalidatePath } from "next/cache";
import { computeEodTotalHours } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addEodReport(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
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
