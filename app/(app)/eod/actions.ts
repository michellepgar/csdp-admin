"use server";

import { revalidatePath } from "next/cache";
import { computeEodTotalHours, isAdmin } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

type EodActionResult = { error: string | null };

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function readEodFields(formData: FormData) {
  const date = (formData.get("date") as string) || "";
  const timeIn = (formData.get("timeIn") as string) || "";
  const timeOut = (formData.get("timeOut") as string) || "";
  const breakStart = (formData.get("breakStart") as string) || "";
  const breakEnd = (formData.get("breakEnd") as string) || "";
  const tasksRaw = (formData.get("tasks") as string) || "";
  const tasks = tasksRaw.split("\n").map((s) => s.trim()).filter(Boolean);
  return { date, timeIn, timeOut, breakStart, breakEnd, tasks };
}

export async function addEodReport(formData: FormData): Promise<EodActionResult> {
  const { date, timeIn, timeOut, breakStart, breakEnd, tasks } = readEodFields(formData);
  if (!date) return { error: "Date is required." };
  if (!timeIn || !timeOut) return { error: "Fill in Time in and Time out so your hours are counted." };
  if (tasks.length === 0) return { error: "Add at least one line about what you worked on." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.eodReports ??= []).push({
        id: `demo-${Date.now()}`,
        author: "Jane",
        date,
        timeIn: timeIn || undefined,
        breakStart: breakStart || undefined,
        breakEnd: breakEnd || undefined,
        timeOut: timeOut || undefined,
        totalHours: computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd) || undefined,
        tasks,
        createdAt: new Date().toISOString(),
      });
    });
    revalidatePath("/eod");
    return { error: null };
  }

  const { supabase, me } = await requireTeamMember();

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
  return { error: null };
}

export async function updateEodReport(formData: FormData): Promise<EodActionResult> {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing report id." };
  const { date, timeIn, timeOut, breakStart, breakEnd, tasks } = readEodFields(formData);
  if (!date) return { error: "Date is required." };

  if (await isDemoMode()) {
    let result: EodActionResult = { error: null };
    await demoMutate((state) => {
      const report = (state.eodReports || []).find((e) => e.id === id);
      if (!report) { result = { error: "This report no longer exists." }; return; }
      const me = state.vas.find((v) => v.name === "Jane");
      if (!(me && isAdmin(me)) && report.author !== "Jane") { result = { error: "You can only edit your own reports." }; return; }
      report.date = date;
      report.timeIn = timeIn || undefined;
      report.breakStart = breakStart || undefined;
      report.breakEnd = breakEnd || undefined;
      report.timeOut = timeOut || undefined;
      report.totalHours = computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd) || undefined;
      report.tasks = tasks;
    });
    if (!result.error) revalidatePath("/eod");
    return result;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: report } = await supabase.from("eod_reports").select("author").eq("id", id).maybeSingle();
  if (!report) return { error: "This report no longer exists." };
  if (!isAdmin(me) && report.author !== me.name) return { error: "You can only edit your own reports." };

  const { error } = await supabase
    .from("eod_reports")
    .update({
      date,
      time_in: timeIn || null,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      time_out: timeOut || null,
      total_hours: computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd) || null,
      tasks,
    })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/eod");
  return { error: null };
}

export async function removeEodReport(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const report = (state.eodReports || []).find((e) => e.id === id);
      if (!report) return;
      const me = state.vas.find((v) => v.name === "Jane");
      if (!(me && isAdmin(me)) && report.author !== "Jane") return;
      state.eodReports = (state.eodReports || []).filter((e) => e.id !== id);
    });
    revalidatePath("/eod");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: report } = await supabase.from("eod_reports").select("author").eq("id", id).maybeSingle();
  if (!report) return;
  if (!isAdmin(me) && report.author !== me.name) return;

  const { error } = await supabase.from("eod_reports").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/eod");
}
