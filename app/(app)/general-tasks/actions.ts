"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addGeneralTask(formData: FormData) {
  const category = (formData.get("category") as string) || "";
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.generalTasks ??= []).push({
        id: `demo-${Date.now()}`,
        category,
        description,
        status: "",
        vaAssigned: [],
        createdAt: new Date().toISOString(),
      });
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("general_tasks").insert({
    id: crypto.randomUUID(),
    category,
    description,
    status: "",
    va_assigned: [],
  });
  orThrow(error);
  revalidatePath("/general-tasks");
}

export async function setGeneralTaskStatus(formData: FormData) {
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.status = status;
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("general_tasks").update({ status }).eq("id", taskId);
  orThrow(error);
  revalidatePath("/general-tasks");
}

export async function signGeneralTask(formData: FormData) {
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task && !task.vaAssigned.includes("Jane")) task.vaAssigned.push("Jane");
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: task } = await supabase.from("general_tasks").select("va_assigned").eq("id", taskId).maybeSingle();
  if (!task || task.va_assigned.includes(me.name)) return;

  const { error } = await supabase
    .from("general_tasks")
    .update({ va_assigned: [...task.va_assigned, me.name] })
    .eq("id", taskId);
  orThrow(error);
  revalidatePath("/general-tasks");
}

export async function removeVaFromGeneralTask(formData: FormData) {
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.vaAssigned = task.vaAssigned.filter((n) => n !== vaName);
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: task } = await supabase.from("general_tasks").select("va_assigned").eq("id", taskId).maybeSingle();
  if (!task) return;

  const { error } = await supabase
    .from("general_tasks")
    .update({ va_assigned: (task.va_assigned as string[]).filter((n) => n !== vaName) })
    .eq("id", taskId);
  orThrow(error);
  revalidatePath("/general-tasks");
}

export async function removeGeneralTask(formData: FormData) {
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.generalTasks = (state.generalTasks || []).filter((t) => t.id !== taskId);
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("general_tasks").delete().eq("id", taskId);
  orThrow(error);
  revalidatePath("/general-tasks");
}
