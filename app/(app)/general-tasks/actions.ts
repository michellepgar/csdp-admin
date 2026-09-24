"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { isAdmin } from "@/lib/app-state";
import { clearTaskFromPlans, clearTaskFromPlansDemo, statusLeavesPlan } from "@/lib/plan-cleanup";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type GeneralTaskActionResult = { error: string | null };

/* Thrown errors inside a Server Action get redacted to a generic
   "Minified React error #441" in production (see app/(app)/overview/
   actions.ts's runPlanAction for the same fix, discovered this
   session) -- both new actions below return {error} instead. */
async function runResultAction(operation: () => Promise<void>): Promise<GeneralTaskActionResult> {
  try {
    await operation();
    return { error: null };
  } catch (error) {
    console.error("General task action failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }
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

export async function updateGeneralTaskDescription(formData: FormData): Promise<GeneralTaskActionResult> {
  const taskId = formData.get("taskId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return { error: "Enter a description." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.description = description;
    });
    revalidatePath("/general-tasks");
    return { error: null };
  }

  return runResultAction(async () => {
    const { supabase } = await requireTeamMember();
    const { error } = await supabase.from("general_tasks").update({ description }).eq("id", taskId);
    orThrow(error);
    revalidatePath("/general-tasks");
  });
}

export async function updateGeneralTaskCategory(formData: FormData): Promise<GeneralTaskActionResult> {
  const taskId = formData.get("taskId") as string;
  const category = ((formData.get("category") as string) || "").trim();
  if (!category) return { error: "Choose a category." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.category = category;
    });
    revalidatePath("/general-tasks");
    return { error: null };
  }

  return runResultAction(async () => {
    const { supabase } = await requireTeamMember();
    const { error } = await supabase.from("general_tasks").update({ category }).eq("id", taskId);
    orThrow(error);
    revalidatePath("/general-tasks");
  });
}

export async function setGeneralTaskStatus(formData: FormData) {
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.status = status;
      if (statusLeavesPlan(status)) clearTaskFromPlansDemo(state, { generalTaskId: taskId });
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("general_tasks").update({ status }).eq("id", taskId);
  orThrow(error);
  if (statusLeavesPlan(status)) await clearTaskFromPlans(supabase, { generalTaskId: taskId });
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
      // Only the VA themselves or an admin can remove someone's name --
      // otherwise any signed-in VA could quietly unassign a coworker.
      const me = state.vas.find((v) => v.name === "Jane");
      if (vaName !== "Jane" && !(me && isAdmin(me))) return;
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (task) task.vaAssigned = task.vaAssigned.filter((n) => n !== vaName);
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase, me } = await requireTeamMember();
  if (vaName !== me.name && !isAdmin(me)) return;

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

/* Bulk counterpart to removeGeneralTask -- one delete for every
   selected id instead of looping the single action per row (unlike
   moveGeneralTasksToSchool's own bulk version, there's no per-task
   side effect here that needs its own round trip, so a single
   .in("id", ...) delete covers the whole selection). */
export async function removeGeneralTasks(formData: FormData): Promise<GeneralTaskActionResult> {
  const taskIds = formData.getAll("taskIds").map(String);
  if (taskIds.length === 0) return { error: null };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.generalTasks = (state.generalTasks || []).filter((t) => !taskIds.includes(t.id));
    });
    revalidatePath("/general-tasks");
    return { error: null };
  }

  return runResultAction(async () => {
    const { supabase } = await requireTeamMember();
    const { error } = await supabase.from("general_tasks").delete().in("id", taskIds);
    orThrow(error);
    revalidatePath("/general-tasks");
  });
}

/* Converts a General Task into a real school task -- creates the file
   + category via the same add_task_file RPC the priority-note flow
   uses (app/(app)/overview/actions.ts's resolvePriorityPlanItem), then
   carries the General Task's CURRENT status and every signed VA over
   (not just the current user -- a bulk carry-over, unlike
   resolvePriorityPlanItem's single-VA sign), then deletes the
   original general_tasks row. */
export async function moveGeneralTaskToSchool(formData: FormData): Promise<GeneralTaskActionResult> {
  const taskId = formData.get("taskId") as string;
  const schoolId = formData.get("schoolId") as string;
  const categoryId = formData.get("categoryId") as string;
  const fileName = ((formData.get("fileName") as string) || "").trim();
  const tableCategoryIdsRaw = (formData.get("tableCategoryIds") as string) || "";
  const categoryIds = tableCategoryIdsRaw ? tableCategoryIdsRaw.split(",").filter(Boolean) : [categoryId];
  if (!fileName) return { error: "Enter a file name." };
  if (!schoolId || !categoryId) return { error: "Choose a school and a category." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = (state.generalTasks || []).find((t) => t.id === taskId);
      if (!task) return;
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      const fileId = `demo-moved-file-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const categoryAssignments = categoryIds.map((cid, i) => {
        const categoryName = state.taskCategories?.find((c) => c.id === cid)?.name || "Uncategorized";
        const isTargetCategory = cid === categoryId;
        return { id: `${fileId}-${i}`, taskFileId: fileId, categoryId: cid, category: categoryName, status: isTargetCategory ? task.status : "", vaAssigned: isTargetCategory ? task.vaAssigned : [], sortOrder: i, createdAt };
      });
      (sd.taskFiles ??= []).push({ id: fileId, fileName, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: categoryAssignments });
      (sd.tasks ??= []).push(...categoryAssignments.map((a, i) => ({ id: a.id, category: a.category, fileName, sortOrder: (sd.taskFiles!.length - 1) * 100 + i, status: a.status, vaAssigned: a.vaAssigned, createdAt })));
      state.generalTasks = (state.generalTasks || []).filter((t) => t.id !== taskId);
    });
    revalidatePath("/general-tasks");
    revalidatePath(`/schools/${schoolId}`);
    return { error: null };
  }

  return runResultAction(async () => {
    const { supabase } = await requireTeamMember();

    const { data: task } = await supabase.from("general_tasks").select("status, va_assigned").eq("id", taskId).maybeSingle();
    if (!task) throw new Error("That task no longer exists.");

    const fileId = crypto.randomUUID();
    const { error: createError } = await supabase.rpc("add_task_file", { p_id: fileId, p_school_id: schoolId, p_file_name: fileName, p_category_ids: categoryIds });
    orThrow(createError);

    const { data: created } = await supabase.from("task_file_categories").select("id").eq("task_file_id", fileId).eq("category_id", categoryId).maybeSingle();
    if (!created) throw new Error("The task was created but could not be carried over — open the school page to finish it manually.");

    const { error: carryOverError } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: created.id, p_patch: { status: task.status, va_assigned: task.va_assigned } });
    orThrow(carryOverError);

    const { error: deleteError } = await supabase.from("general_tasks").delete().eq("id", taskId);
    orThrow(deleteError);

    revalidatePath("/general-tasks");
    revalidatePath(`/schools/${schoolId}`);
  });
}

/* Bulk version of moveGeneralTaskToSchool -- one destination (school,
   plus either a plain category or an existing table + category
   mapping) applied to every selected task, each still becoming its
   own new file. Loops the same per-task logic; if one task in the
   batch fails (e.g. deleted by someone else mid-flight), the error
   names which one and the rest still complete. fileNames is a JSON
   map keyed by task id (each task keeps its own file name, its
   current description by default) since a bulk move has no single
   shared file name to submit. */
export async function moveGeneralTasksToSchool(formData: FormData): Promise<GeneralTaskActionResult> {
  const taskIds = formData.getAll("taskIds").map(String);
  if (taskIds.length === 0) return { error: "Select at least one task." };
  const fileNamesJson = (formData.get("fileNames") as string) || "{}";
  const fileNames: Record<string, string> = JSON.parse(fileNamesJson);

  for (const taskId of taskIds) {
    const single = new FormData();
    single.set("taskId", taskId);
    single.set("schoolId", formData.get("schoolId") as string);
    single.set("categoryId", formData.get("categoryId") as string);
    single.set("fileName", fileNames[taskId] || "");
    single.set("tableCategoryIds", (formData.get("tableCategoryIds") as string) || "");
    const result = await moveGeneralTaskToSchool(single);
    if (result.error) return { error: `Failed on one task: ${result.error}` };
  }
  return { error: null };
}

export async function addGeneralTaskCategory(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.generalTaskCategories ??= []).push({ id: `demo-${Date.now()}`, name });
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("general_task_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("general_task_categories")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/general-tasks");
}

export async function removeGeneralTaskCategory(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.generalTaskCategories = (state.generalTaskCategories || []).filter((c) => c.id !== id);
    });
    revalidatePath("/general-tasks");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("general_task_categories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/general-tasks");
}
