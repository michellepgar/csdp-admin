"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/require-team-member";
import { syncContactRowEmail } from "@/lib/sync-contact-row";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { getOrderedItems, hasExactIds, normalizedCategoryName } from "@/lib/task-ordering";
import { groupTaskTables, selectedCategoryFiles, normalizeSelectedCategoryIds, saveTaskFile, type TaskFileActionResult } from "@/lib/shared-task-files";
import { nextChecklistNotNeededEntry } from "@/lib/app-state";
import type { AppState, TaskFileCategory } from "@/lib/app-state";

/* Every action in this file used to start with a helper that ran
   fetchAppState() -- the whole app's ~25-table Promise.all -- just to
   get `me` (and, in most cases, one field of one record it could have
   queried directly). That meant every single click-to-save here paid
   for the entire app's data TWICE: once inside the action, and again
   when revalidatePath() forces the page to re-render right after (see
   fetchAppState()'s own comment on why those two runs can't share a
   cache -- they're genuinely separate requests). That's the actual
   cause behind "it takes time to save" -- not network flakiness.

   requireTeamMember() (a single `vas` lookup) replaces it everywhere;
   anywhere a permission check used to call canEditSchoolRecords() with
   the full state, that check is gone too -- it always returns `true`
   now (see lib/app-state.ts), so fetching state just to feed it was
   pure waste. The handful of actions that genuinely need one existing
   record's current value (an array to append/filter, a school's name)
   fetch just that one row instead of the whole app.

   Every action here also checks isDemoMode() first, before ever
   calling requireTeamMember() (which throws for the demo user -- it
   has no real Supabase session). That branch mutates the demo
   visitor's own cookie-backed state (lib/demo-session.ts) instead of
   the real database, so add/remove/edit all genuinely work in the
   demo without ever touching real data or persisting past sign-out. */

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function revalidateSchool(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
}

function findDemoAssignment(state: AppState, schoolId: string, taskId: string): TaskFileCategory | undefined {
  return state.schoolData[schoolId]?.taskFiles?.flatMap((file) => file.categories).find((item) => item.id === taskId);
}

/* ---------- Yearly Checklist ---------- */

export async function toggleChecklistItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const key = `${schoolId}:${itemId}`;
      const isDone = state.checklistProgress[key]?.status === "Done";
      state.checklistProgress[key] = isDone ? { status: "Open", notNeeded: false } : { status: "Done", checkedBy: "Jane", notNeeded: false };
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();
  /* Anyone on the team can check a checklist item off, not just the
     school's assigned VA -- who actually did it is recorded below and
     shown as a small signature, instead of gating who's allowed to. */

  const { data: current } = await supabase
    .from("checklist_progress")
    .select("status")
    .eq("school_id", schoolId)
    .eq("template_item_id", itemId)
    .maybeSingle();
  const isDone = current?.status === "Done";

  const { error } = await supabase
    .from("checklist_progress")
    .upsert(
      { school_id: schoolId, template_item_id: itemId, status: isDone ? "Open" : "Done", checked_by: isDone ? null : me.name, not_needed: false },
      { onConflict: "school_id,template_item_id" }
    );
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addChecklistTemplateItem(formData: FormData) {
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.checklistTemplate.push({ id: `demo-${Date.now()}`, description });
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("checklist_template")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("checklist_template")
    .insert({ id: crypto.randomUUID(), description, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/", "layout");
}

export async function removeChecklistTemplateItem(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.checklistTemplate = state.checklistTemplate.filter((t) => t.id !== id);
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: templateItem, error: templateItemError } = await supabase.from("checklist_template").select("task_category_id").eq("id", id).maybeSingle();
  orThrow(templateItemError);
  if (templateItem?.task_category_id) throw new Error("This checklist item is managed by its school-only category.");

  const { error } = await supabase.from("checklist_template").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* For drag-and-drop reordering (checklist-card.tsx) -- a drag can move
   an item several places in one go, so this takes the WHOLE new order
   and renumbers every row's sort_order to match its new index, rather
   than a series of pairwise swaps. Called directly as a plain async
   function from the client (a Server Action doesn't have to be bound
   to a <form action={...}> -- any serializable arguments work), not
   through a form, since there's no single click event a <form> would
   submit from. */
export async function reorderChecklistTemplate(orderedIds: string[]) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const byId = new Map(state.checklistTemplate.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((t) => t !== undefined);
      if (reordered.length === state.checklistTemplate.length) state.checklistTemplate = reordered;
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  await Promise.all(
    orderedIds.map((id, i) => supabase.from("checklist_template").update({ sort_order: i }).eq("id", id))
  );
  revalidatePath("/", "layout");
}

/* ---------- Tasks ---------- */

export async function addTask(formData: FormData): Promise<TaskFileActionResult> {
  const schoolId = formData.get("schoolId") as string;
  const categoryIds = normalizeSelectedCategoryIds(formData.getAll("categoryIds").map(String));
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName || categoryIds.length === 0) return { error: "Enter a file name and choose at least one category." };

  if (await isDemoMode()) {
    const result = await saveTaskFile(() => demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      const fileId = `demo-file-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const selected = categoryIds.map((categoryId, index) => {
        const category = state.taskCategories?.find((item) => item.id === categoryId)?.name || "Uncategorized";
        return { id: `${fileId}-${index}`, taskFileId: fileId, categoryId, category, status: "", vaAssigned: [], sortOrder: index, createdAt };
      });
      (sd.taskFiles ??= []).push({ id: fileId, fileName, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: selected });
      for (const assignment of selected) (sd.tasks ??= []).push({ id: assignment.id, category: assignment.category, fileName, sortOrder: sd.taskFiles.length - 1, status: "", vaAssigned: [], createdAt });
    }));
    if (!result.error) revalidateSchool(schoolId);
    return result;
  }

  const { supabase } = await requireTeamMember();

  const result = await saveTaskFile(async () => {
    const { error } = await supabase.rpc("add_task_file", {
      p_id: crypto.randomUUID(),
      p_school_id: schoolId,
      p_file_name: fileName,
      p_category_ids: categoryIds,
    });
    if (error) throw error;
  });
  if (!result.error) revalidateSchool(schoolId);
  return result;
}

export async function addCategoryToFiles(formData: FormData): Promise<TaskFileActionResult> {
  const schoolId=String(formData.get("schoolId") || "");
  const tableId=String(formData.get("tableId") || "");
  const categoryId=String(formData.get("categoryId") || "");
  const fileIds=normalizeSelectedCategoryIds(formData.getAll("fileIds").map(String));
  if (!schoolId || !tableId || !categoryId || fileIds.length === 0) return {error:"Choose a category and select at least one file."};
  if (await isDemoMode()) {
    const result=await saveTaskFile(() => demoMutate(state => {
      const sd=state.schoolData[schoolId];
      const group=groupTaskTables(state.taskCategories || [],sd?.taskFiles || []).find(group => group.key === tableId);
      const category=state.taskCategories?.find(category => category.id === categoryId);
      if (!group || !category) throw new Error("Invalid category or table");
      const selected=selectedCategoryFiles(group.files,fileIds,categoryId);
      const existing=group.files.flatMap(file => file.categories).filter(a => a.categoryId === categoryId);
      const position=existing.length ? Math.min(...existing.map(a=>a.sortOrder)) : Math.max(-1,...group.files.flatMap(file=>file.categories).map(a=>a.sortOrder))+1;
      for (const file of group.files) file.tableId=tableId;
      for (const file of selected) {
        const assignment={id:crypto.randomUUID(),taskFileId:file.id,categoryId,category:category.name,status:"",vaAssigned:[],sortOrder:position,createdAt:new Date().toISOString()};
        file.categories.push(assignment);
        (sd.tasks ??= []).push({...assignment,fileName:file.fileName});
      }
    }));
    if (!result.error) revalidateSchool(schoolId);
    return result;
  }
  const {supabase}=await requireTeamMember();
  const result=await saveTaskFile(async()=>{
    const {error}=await supabase.rpc("add_task_file_category",{p_school_id:schoolId,p_table_id:tableId,p_file_ids:fileIds,p_category_id:categoryId});
    if (error) throw error;
  });
  if (!result.error) revalidateSchool(schoolId);
  return result;
}

/* Moves an existing file's category assignment to a different category
   -- everything else about the row (status, VAs, count, comms) carries
   over untouched, since move_task_file_category only ever updates
   category_id. Re-bucketing into the right table afterward needs no
   extra client logic -- groupTaskTables already re-derives table
   membership from each file's current categories on every render. */
export async function moveTaskFileCategory(formData: FormData): Promise<TaskFileActionResult> {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const newCategoryId = formData.get("newCategoryId") as string;
  if (!newCategoryId) return { error: "Choose a category." };

  if (await isDemoMode()) {
    const result = await saveTaskFile(() => demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      const category = state.taskCategories?.find((item) => item.id === newCategoryId);
      if (!category) throw new Error("That category no longer exists");
      const file = sd?.taskFiles?.find((item) => item.categories.some((a) => a.id === taskId));
      const assignment = file?.categories.find((item) => item.id === taskId);
      if (!file || !assignment) throw new Error("Task does not belong to this school");
      if (file.categories.some((item) => item.categoryId === newCategoryId && item.id !== taskId)) throw new Error("This file is already in that category");
      assignment.categoryId = newCategoryId;
      assignment.category = category.name;
      const task = sd.tasks?.find((item) => item.id === taskId);
      if (task) task.category = category.name;
    }));
    if (!result.error) revalidateSchool(schoolId);
    return result;
  }

  const { supabase } = await requireTeamMember();
  const result = await saveTaskFile(async () => {
    const { error } = await supabase.rpc("move_task_file_category", { p_school_id: schoolId, p_task_id: taskId, p_new_category_id: newCategoryId });
    if (error) throw error;
  });
  if (!result.error) revalidateSchool(schoolId);
  return result;
}

export async function reorderTasks(schoolId: string, orderedIds: string[]) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const files = state.schoolData[schoolId]?.taskFiles ?? [];
      if (!hasExactIds(files.map((file) => file.id), orderedIds)) return;
      state.schoolData[schoolId].taskFiles = getOrderedItems(files, orderedIds).map((file, sortOrder) => ({ ...file, sortOrder }));
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();
  const { error } = await supabase.rpc("reorder_task_files", { p_school_id: schoolId, p_ordered_ids: orderedIds });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function updateTaskFileName(formData: FormData): Promise<TaskFileActionResult> {
  const schoolId = formData.get("schoolId") as string;
  const taskFileId = formData.get("taskFileId") as string;
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return { error: "Enter a file name." };

  if (await isDemoMode()) {
    const result = await saveTaskFile(() => demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      const file = sd?.taskFiles?.find((item) => item.id === taskFileId);
      if (file) {
        file.fileName = fileName;
        const assignmentIds = new Set(file.categories.map((item) => item.id));
        for (const task of sd.tasks || []) if (assignmentIds.has(task.id)) task.fileName = fileName;
      }
    }));
    if (!result.error) revalidateSchool(schoolId);
    return result;
  }

  const { supabase } = await requireTeamMember();
  const result = await saveTaskFile(async () => {
    const { error } = await supabase.from("task_files").update({ file_name: fileName }).eq("id", taskFileId).eq("school_id", schoolId);
    if (error) throw error;
  });
  if (!result.error) revalidateSchool(schoolId);
  return result;
}

export async function setTaskStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.status = status;
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment) assignment.status = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { status } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setTaskCount(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const count = (formData.get("count") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.count = count;
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment) assignment.count = count;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { count } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function signTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task && !task.vaAssigned.includes("Jane")) task.vaAssigned.push("Jane");
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment && !assignment.vaAssigned.includes("Jane")) assignment.vaAssigned.push("Jane");
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: task } = await supabase.from("task_file_categories").select("va_assigned, task_files!inner(school_id)").eq("id", taskId).eq("task_files.school_id", schoolId).maybeSingle();
  if (!task || task.va_assigned.includes(me.name)) return;

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { va_assigned: [...task.va_assigned, me.name] } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeVaFromTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.vaAssigned = task.vaAssigned.filter((n) => n !== vaName);
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment) assignment.vaAssigned = assignment.vaAssigned.filter((name) => name !== vaName);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: task } = await supabase.from("task_file_categories").select("va_assigned, task_files!inner(school_id)").eq("id", taskId).eq("task_files.school_id", schoolId).maybeSingle();
  if (!task) return;

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { va_assigned: (task.va_assigned as string[]).filter((n) => n !== vaName) } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskFileId = formData.get("taskFileId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      const file = sd?.taskFiles?.find((item) => item.id === taskFileId);
      if (sd?.taskFiles) sd.taskFiles = sd.taskFiles.filter((item) => item.id !== taskFileId);
      if (sd?.tasks && file) sd.tasks = sd.tasks.filter((item) => item.fileName !== file.fileName);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.rpc("remove_task_file", { p_school_id: schoolId, p_file_id: taskFileId });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setChecklistNotNeeded(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const notNeeded = formData.get("notNeeded") === "true";
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const key = `${schoolId}:${itemId}`;
      state.checklistProgress[key] = nextChecklistNotNeededEntry(state.checklistProgress[key], notNeeded);
    });
    revalidateSchool(schoolId);
    return;
  }
  const { supabase } = await requireTeamMember();
  const { data: current, error: currentError } = await supabase.from("checklist_progress").select("status, checked_by, not_needed").eq("school_id", schoolId).eq("template_item_id", itemId).maybeSingle();
  orThrow(currentError);
  const next = nextChecklistNotNeededEntry(current ? { status: current.status, checkedBy: current.checked_by ?? undefined, notNeeded: current.not_needed } : undefined, notNeeded);
  const { error } = await supabase.from("checklist_progress").upsert({
    school_id: schoolId,
    template_item_id: itemId,
    status: next.status,
    checked_by: next.checkedBy ?? null,
    not_needed: !!next.notNeeded,
  }, { onConflict: "school_id,template_item_id" });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeTaskAssignment(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      for (const file of sd?.taskFiles || []) file.categories = file.categories.filter((item) => item.id !== taskId);
      if (sd?.tasks) sd.tasks = sd.tasks.filter((item) => item.id !== taskId);
      if (sd?.taskFiles) sd.taskFiles = sd.taskFiles.filter((file) => file.categories.length > 0);
    });
    revalidateSchool(schoolId);
    return;
  }
  const { supabase } = await requireTeamMember();
  const { error } = await supabase.rpc("remove_task_assignment", { p_school_id: schoolId, p_task_id: taskId });
  orThrow(error);
  revalidateSchool(schoolId);
}

/* ---------- Task Communications (Initial/Follow up only) ---------- */

export async function setCommsStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.commsStatus = status;
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment) assignment.commsStatus = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { comms_status: status } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function signComms(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) {
        task.commsVaAssigned ??= [];
        if (!task.commsVaAssigned.includes("Jane")) task.commsVaAssigned.push("Jane");
      }
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment) {
        assignment.commsVaAssigned ??= [];
        if (!assignment.commsVaAssigned.includes("Jane")) assignment.commsVaAssigned.push("Jane");
      }
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: task } = await supabase.from("task_file_categories").select("comms_va_assigned, task_files!inner(school_id)").eq("id", taskId).eq("task_files.school_id", schoolId).maybeSingle();
  if (!task) return;
  const commsVaAssigned: string[] = task.comms_va_assigned || [];
  if (commsVaAssigned.includes(me.name)) return;

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { comms_va_assigned: [...commsVaAssigned, me.name] } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeVaFromComms(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task?.commsVaAssigned) task.commsVaAssigned = task.commsVaAssigned.filter((n) => n !== vaName);
      const assignment = findDemoAssignment(state, schoolId, taskId);
      if (assignment?.commsVaAssigned) assignment.commsVaAssigned = assignment.commsVaAssigned.filter((name) => name !== vaName);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: task } = await supabase.from("task_file_categories").select("comms_va_assigned, task_files!inner(school_id)").eq("id", taskId).eq("task_files.school_id", schoolId).maybeSingle();
  if (!task) return;

  const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskId, p_patch: { comms_va_assigned: ((task.comms_va_assigned as string[]) || []).filter((n) => n !== vaName) } });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addTaskCategory(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      if (state.taskCategories?.some((category) => normalizedCategoryName(category.name) === normalizedCategoryName(name))) return;
      (state.taskCategories ??= []).push({ id: `demo-${Date.now()}`, name });
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: duplicate, error: duplicateError } = await supabase.from("task_categories").select("id").is("school_id", null).ilike("name", name).maybeSingle();
  orThrow(duplicateError);
  if (duplicate) throw new Error("A task category already uses that name.");

  const { data: maxRow } = await supabase
    .from("task_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("task_categories")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/", "layout");
}

export async function removeTaskCategory(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      if (Object.values(state.schoolData).some((sd) => sd.taskFiles?.some((file) => file.categories.some((assignment) => assignment.categoryId === id)))) throw new Error("This category still has files. Remove its tasks before deleting the category.");
      state.taskCategories = (state.taskCategories || []).filter((c) => c.id !== id);
      state.checklistTemplate = (state.checklistTemplate || []).filter((item) => item.taskCategoryId !== id);
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();
  const { count, error: countError } = await supabase.from("task_file_categories").select("id", { count: "exact", head: true }).eq("category_id", id);
  orThrow(countError);
  if (count) throw new Error("This category still has files. Remove its tasks before deleting the category.");
  const { error } = await supabase.from("task_categories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

export async function reorderTaskCategories(orderedIds: string[]) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const categories = state.taskCategories ?? [];
      if (!hasExactIds(categories.map((category) => category.id), orderedIds)) return;
      state.taskCategories = getOrderedItems(categories, orderedIds);
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: categories, error: categoriesError } = await supabase.from("task_categories").select("id").in("id", orderedIds);
  orThrow(categoriesError);
  if (!hasExactIds((categories ?? []).map((category) => category.id), orderedIds)) return;
  const results = await Promise.all(
    orderedIds.map((id, sortOrder) => supabase.from("task_categories").update({ sort_order: sortOrder }).eq("id", id))
  );
  results.forEach(({ error }) => orThrow(error));
  revalidatePath("/", "layout");
}

/* Returns a result instead of throwing bare -- the old void-returning
   version's caller (tasks-card.tsx's rename form) closed its own edit
   box on click, before the Server Action even resolved, so a rename
   that failed (e.g. the duplicate-name check below) looked exactly
   like a rename that quietly did nothing: the box vanished either
   way, no error ever reached the screen. Now the caller awaits this
   and only closes on an actual empty error. */
export async function renameTaskCategory(formData: FormData): Promise<TaskFileActionResult> {
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return { error: "Name is required." };

  try {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const category = state.taskCategories?.find((item) => item.id === id);
        if (!category) throw new Error("That category no longer exists. Refresh and try again.");
        if (category.name === name) return;
        if (state.taskCategories?.some((item) => item.id !== id && normalizedCategoryName(item.name) === normalizedCategoryName(name))) {
          throw new Error("A task category already uses that name.");
        }
        const previousName = category.name;
        category.name = name;
        for (const schoolData of Object.values(state.schoolData)) {
          for (const task of schoolData.tasks ?? []) if (task.category === previousName) task.category = name;
          for (const file of schoolData.taskFiles ?? []) for (const assignment of file.categories) if (assignment.categoryId === id) assignment.category = name;
        }
        for (const item of state.checklistTemplate || []) if (item.taskCategoryId === category.id) item.description = name;
      });
      revalidatePath("/", "layout");
      return { error: null };
    }

    const { supabase } = await requireTeamMember();
    const { data: category, error: categoryError } = await supabase.from("task_categories").select("name").eq("id", id).maybeSingle();
    orThrow(categoryError);
    if (!category) return { error: "That category no longer exists. Refresh and try again." };
    if (category.name !== name) {
      const duplicateQuery = supabase.from("task_categories").select("id").ilike("name", name).neq("id", id);
      const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
      orThrow(duplicateError);
      if (duplicate) return { error: "A task category already uses that name." };
      const { error: renameError } = await supabase.rpc("rename_task_category", { p_id: id, p_name: name });
      orThrow(renameError);
    }
    revalidatePath("/", "layout");
    return { error: null };
  } catch (error) {
    console.error("Task category rename failed", error);
    return { error: error instanceof Error ? error.message : "The category could not be renamed. Please try again." };
  }
}

export async function setTaskCategoryHasCount(formData: FormData) {
  const id = formData.get("id") as string;
  const hasCount = formData.get("hasCount") === "on";
  if (!id) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const category = state.taskCategories?.find((item) => item.id === id);
      if (category) category.hasCount = hasCount;
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();
  const { error } = await supabase.from("task_categories").update({ has_count: hasCount }).eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* ---------- Email Tracker ---------- */

export async function addEmailItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      (sd.emailTracker ??= []).push({ id: `demo-${Date.now()}`, description, status: "Needs My Response", addedBy: "Jane", createdAt: new Date().toISOString() });
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    description,
    status: "Needs My Response",
    added_by: me.name,
  });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function updateEmailItemDescription(formData: FormData): Promise<TaskFileActionResult> {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return { error: "Enter what the email is about." };

  if (await isDemoMode()) {
    const result = await saveTaskFile(() => demoMutate((state) => {
      const item = state.schoolData[schoolId]?.emailTracker?.find((e) => e.id === itemId);
      if (item) item.description = description;
    }));
    if (!result.error) revalidateSchool(schoolId);
    return result;
  }

  const { supabase } = await requireTeamMember();
  const result = await saveTaskFile(async () => {
    const { error } = await supabase.from("email_tracker_items").update({ description }).eq("id", itemId).eq("school_id", schoolId);
    if (error) throw error;
  });
  if (!result.error) revalidateSchool(schoolId);
  return result;
}

export async function setEmailStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = state.schoolData[schoolId]?.emailTracker?.find((e) => e.id === itemId);
      if (item) item.status = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").update({ status }).eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeEmailItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      if (sd?.emailTracker) sd.emailTracker = sd.emailTracker.filter((e) => e.id !== itemId);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").delete().eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setSchoolEmailNotes(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const emailNotes = (formData.get("emailNotes") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      if (school) school.emailNotes = emailNotes || undefined;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("schools").update({ email_notes: emailNotes || null }).eq("id", schoolId);
  orThrow(error);
  revalidateSchool(schoolId);
}

/* Website/hours used to be editable right here (see git history) --
   now only editable from a contact row's edit form on the Contacts
   page (app/(app)/contacts/actions.ts's updateContactRow), which
   updates this same `schools` table. This page only displays them. */

/* ---------- Rename school ---------- */

/* The school page is the only place a school's name can be changed --
   Contacts and Distribution List both only ever show/match it, never
   edit it. Contacts and Distribution List rows aren't linked to a
   school by id, only by this exact name (see removeSchoolAndContacts's
   own comment above), so renaming has to also rewrite every row that
   currently carries the old name to the new one, or they'd silently
   stop matching this school at all -- the contact/distribution info
   would still exist, just orphaned under a name nothing points to
   anymore. */
export async function renameSchool(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const newName = ((formData.get("name") as string) || "").trim();
  if (!newName) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      if (!school || school.name === newName) return;
      const oldName = school.name;
      school.name = newName;
      for (const g of state.contactGroups || []) for (const r of g.rows) if (r.school === oldName) r.school = newName;
      for (const g of state.distributionGroups || []) for (const r of g.rows) if (r.school === oldName) r.school = newName;
    });
    revalidatePath("/", "layout");
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (!school || school.name === newName) return;
  const oldName = school.name;

  const { error } = await supabase.from("schools").update({ name: newName }).eq("id", schoolId);
  orThrow(error);

  const { error: contactsError } = await supabase.from("contact_rows").update({ school: newName }).eq("school", oldName);
  orThrow(contactsError);
  const { error: distributionError } = await supabase.from("distribution_rows").update({ school: newName }).eq("school", oldName);
  orThrow(distributionError);

  revalidatePath("/", "layout");
  revalidateSchool(schoolId);
}

/* ---------- Remove school ---------- */

/* Deletes the school row only. Cascades (via "on delete cascade" FKs)
   remove its tasks, checklist progress, email tracker items, and
   school_contacts automatically. Contacts (contact_rows) and
   Distribution List (distribution_rows) are matched by school NAME,
   not a foreign key, so they're untouched here on purpose -- use
   removeSchoolAndContacts instead to also clear those. */
export async function removeSchool(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.schools = state.schools.filter((s) => s.id !== schoolId);
      delete state.schoolData[schoolId];
    });
    revalidatePath("/", "layout");
    redirect("/overview");
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  orThrow(error);

  revalidatePath("/", "layout");
  redirect("/overview");
}

/* Same as removeSchool, but also deletes this school's row on the
   Contacts page and Distribution List (matched by name, captured
   before the school itself is deleted). */
export async function removeSchoolAndContacts(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      state.schools = state.schools.filter((s) => s.id !== schoolId);
      delete state.schoolData[schoolId];
      if (school) {
        for (const g of state.contactGroups || []) g.rows = g.rows.filter((r) => r.school !== school.name);
        for (const g of state.distributionGroups || []) g.rows = g.rows.filter((r) => r.school !== school.name);
      }
    });
    revalidatePath("/", "layout");
    redirect("/overview");
  }

  const { supabase } = await requireTeamMember();
  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  orThrow(error);

  if (school) {
    await supabase.from("contact_rows").delete().eq("school", school.name);
    await supabase.from("distribution_rows").delete().eq("school", school.name);
  }

  revalidatePath("/", "layout");
  redirect("/overview");
}

/* ---------- School Contacts (position + email, editable anytime) ---------- */

export async function addSchoolContact(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.schoolContacts ??= {})[schoolId] ??= [];
      state.schoolContacts[schoolId].push({ id: `demo-${Date.now()}`, position, name: name || undefined, email, createdAt: new Date().toISOString() });
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("school_contacts").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    position,
    name: name || null,
    email,
  });
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function updateSchoolContact(formData: FormData) {
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const contact = state.schoolContacts?.[schoolId]?.find((c) => c.id === id);
      if (contact) {
        contact.position = position;
        contact.name = name || undefined;
        contact.email = email;
      }
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("school_contacts").update({ position, name: name || null, email }).eq("id", id);
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function removeSchoolContact(formData: FormData) {
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const list = state.schoolContacts?.[schoolId];
      if (list) state.schoolContacts![schoolId] = list.filter((c) => c.id !== id);
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: existing } = await supabase.from("school_contacts").select("position").eq("id", id).maybeSingle();

  const { error } = await supabase.from("school_contacts").delete().eq("id", id);
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school && existing) await syncContactRowEmail(supabase, schoolId, school.name, existing.position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}
