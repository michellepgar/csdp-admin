"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { isAdmin } from "@/lib/app-state";
import { diffPlanSelection } from "@/lib/shared-task-files";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function requireAdmin() {
  const { supabase, me } = await requireTeamMember();
  if (!isAdmin(me)) throw new Error("Not authorized");
  return { supabase, me };
}

/* Save/edit a VA's own plan for tomorrow -- formData carries every id
   currently checked in the End Today's Work picker (carry-over items
   included), split into taskFileCategoryIds (school tasks) and
   generalTaskIds (General Tasks, which have no schoolId). Diffs each
   set separately against that VA's existing kind:"task" plan_items
   rows so re-opening the picker later and checking/unchecking things
   converges instead of duplicating rows. `labels` covers both kinds of
   id in one map, keyed by whichever id it is, since ids never collide
   across the two tables in practice (both are app-generated uuids). */
export async function savePlan(formData: FormData) {
  const checkedTaskIds = formData.getAll("taskFileCategoryIds").map(String);
  const checkedGeneralIds = formData.getAll("generalTaskIds").map(String);
  const labelsJson = formData.get("labels") as string; // { [id]: { label, schoolId? } } -- schoolId absent for General Tasks
  const labels: Record<string, { label: string; schoolId?: string }> = labelsJson ? JSON.parse(labelsJson) : {};

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const existingTask = (state.planItems || []).filter((p) => p.kind === "task" && p.vaName === "Jane" && p.taskFileCategoryId).map((p) => ({ id: p.id, refId: p.taskFileCategoryId }));
      const existingGeneral = (state.planItems || []).filter((p) => p.kind === "task" && p.vaName === "Jane" && p.generalTaskId).map((p) => ({ id: p.id, refId: p.generalTaskId }));
      const taskDiff = diffPlanSelection(existingTask, checkedTaskIds);
      const generalDiff = diffPlanSelection(existingGeneral, checkedGeneralIds);
      const toDeleteIds = [...taskDiff.toDeleteIds, ...generalDiff.toDeleteIds];
      state.planItems = (state.planItems || []).filter((p) => !toDeleteIds.includes(p.id));
      for (const id of taskDiff.toInsert) {
        const info = labels[id];
        if (!info) continue;
        state.planItems.push({ id: `demo-plan-${id}`, kind: "task", vaName: "Jane", schoolId: info.schoolId, taskFileCategoryId: id, label: info.label, createdBy: "Jane", createdAt: new Date().toISOString() });
      }
      for (const id of generalDiff.toInsert) {
        const info = labels[id];
        if (!info) continue;
        state.planItems.push({ id: `demo-plan-${id}`, kind: "task", vaName: "Jane", generalTaskId: id, label: info.label, createdBy: "Jane", createdAt: new Date().toISOString() });
      }
    });
    revalidatePath("/overview");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: existingRows } = await supabase.from("plan_items").select("id, task_file_category_id, general_task_id").eq("kind", "task").eq("va_name", me.name);
  const existingTask = (existingRows || []).filter((r) => r.task_file_category_id).map((r) => ({ id: r.id, refId: r.task_file_category_id as string }));
  const existingGeneral = (existingRows || []).filter((r) => r.general_task_id).map((r) => ({ id: r.id, refId: r.general_task_id as string }));
  const taskDiff = diffPlanSelection(existingTask, checkedTaskIds);
  const generalDiff = diffPlanSelection(existingGeneral, checkedGeneralIds);

  const toDeleteIds = [...taskDiff.toDeleteIds, ...generalDiff.toDeleteIds];
  if (toDeleteIds.length > 0) {
    const { error } = await supabase.from("plan_items").delete().in("id", toDeleteIds);
    orThrow(error);
  }

  const rows = [
    ...taskDiff.toInsert.map((id) => ({ kind: "task" as const, va_name: me.name, school_id: labels[id]?.schoolId, task_file_category_id: id, label: labels[id]?.label || "", created_by: me.name })),
    ...generalDiff.toInsert.map((id) => ({ kind: "task" as const, va_name: me.name, general_task_id: id, label: labels[id]?.label || "", created_by: me.name })),
  ];
  if (rows.length > 0) {
    const { error } = await supabase.from("plan_items").insert(rows);
    orThrow(error);
  }
  revalidatePath("/overview");
}

/* Boss-only: add a freeform priority note, optionally targeted at one
   VA (leave assignedTo blank for a shared/unassigned item anyone can
   pick up). Not linked to any real task yet -- see resolvePriorityPlanItem. */
export async function addPriority(formData: FormData) {
  const label = ((formData.get("label") as string) || "").trim();
  const assignedTo = ((formData.get("assignedTo") as string) || "").trim() || undefined;
  if (!label) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.planItems ??= []).push({ id: `demo-priority-${Date.now()}`, kind: "priority", vaName: assignedTo, label, createdBy: "Jane", createdAt: new Date().toISOString() });
    });
    revalidatePath("/overview");
    return;
  }

  const { supabase, me } = await requireAdmin();
  const { error } = await supabase.from("plan_items").insert({ kind: "priority", va_name: assignedTo ?? null, label, created_by: me.name });
  orThrow(error);
  revalidatePath("/overview");
}

/* Either VA can remove any pending plan item -- matches this app's
   existing team-wide trust model (no per-row ownership enforcement
   anywhere else either, see plan_items' own RLS policy). */
export async function removePlanItem(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.planItems = (state.planItems || []).filter((p) => p.id !== id);
    });
    revalidatePath("/overview");
    return;
  }

  const { supabase } = await requireTeamMember();
  const { error } = await supabase.from("plan_items").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/overview");
}

/* Resolve a kind:"task" plan item -- signs the current VA onto the
   linked task and sets its status, then deletes the plan_items row.
   "Review" if the task is currently Completed (checked live, not from
   a stale snapshot), "In Progress" otherwise. If the linked task/file
   was deleted since planning, just drops the stale row instead of
   throwing. Exactly one of taskFileCategoryId/schoolId (school tasks,
   via the same update_task_assignment RPC tasks-card.tsx uses) or
   generalTaskId (General Tasks, plain table update -- mirrors
   app/(app)/general-tasks/actions.ts's own setGeneralTaskStatus/
   signGeneralTask) is present. */
export async function resolveTaskPlanItem(formData: FormData) {
  const id = formData.get("id") as string;
  const taskFileCategoryId = (formData.get("taskFileCategoryId") as string) || "";
  const schoolId = (formData.get("schoolId") as string) || "";
  const generalTaskId = (formData.get("generalTaskId") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      if (taskFileCategoryId) {
        const assignment = state.schoolData[schoolId]?.taskFiles?.flatMap((f) => f.categories).find((c) => c.id === taskFileCategoryId);
        if (assignment) {
          if (!assignment.vaAssigned.includes("Jane")) assignment.vaAssigned.push("Jane");
          assignment.status = assignment.status === "Completed" ? "Review" : "In Progress";
          const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskFileCategoryId);
          if (task) { if (!task.vaAssigned.includes("Jane")) task.vaAssigned.push("Jane"); task.status = assignment.status; }
        }
      } else if (generalTaskId) {
        const task = (state.generalTasks || []).find((t) => t.id === generalTaskId);
        if (task) {
          if (!task.vaAssigned.includes("Jane")) task.vaAssigned.push("Jane");
          task.status = task.status === "Completed" ? "Review" : "In Progress";
        }
      }
      state.planItems = (state.planItems || []).filter((p) => p.id !== id);
    });
    revalidatePath("/overview");
    if (schoolId) revalidatePath(`/schools/${schoolId}`);
    else revalidatePath("/general-tasks");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  if (taskFileCategoryId) {
    const { data: task } = await supabase.from("task_file_categories").select("status, va_assigned").eq("id", taskFileCategoryId).maybeSingle();
    if (!task) {
      await supabase.from("plan_items").delete().eq("id", id);
      revalidatePath("/overview");
      return;
    }
    const nextStatus = task.status === "Completed" ? "Review" : "In Progress";
    const nextVaAssigned = task.va_assigned.includes(me.name) ? task.va_assigned : [...task.va_assigned, me.name];
    const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskFileCategoryId, p_patch: { status: nextStatus, va_assigned: nextVaAssigned } });
    orThrow(error);
    await supabase.from("plan_items").delete().eq("id", id);
    revalidatePath("/overview");
    revalidatePath(`/schools/${schoolId}`);
    return;
  }

  const { data: generalTask } = await supabase.from("general_tasks").select("status, va_assigned").eq("id", generalTaskId).maybeSingle();
  if (!generalTask) {
    await supabase.from("plan_items").delete().eq("id", id);
    revalidatePath("/overview");
    return;
  }
  const nextStatus = generalTask.status === "Completed" ? "Review" : "In Progress";
  const nextVaAssigned = generalTask.va_assigned.includes(me.name) ? generalTask.va_assigned : [...generalTask.va_assigned, me.name];
  const { error } = await supabase.from("general_tasks").update({ status: nextStatus, va_assigned: nextVaAssigned }).eq("id", generalTaskId);
  orThrow(error);
  await supabase.from("plan_items").delete().eq("id", id);
  revalidatePath("/overview");
  revalidatePath("/general-tasks");
}

/* Resolve a kind:"priority" item -- creates the real task (school +
   category + file name, reusing add_task_file), signs the VA, sets it
   In Progress, then deletes the plan_items row. */
export async function resolvePriorityPlanItem(formData: FormData) {
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;
  const categoryId = formData.get("categoryId") as string;
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) throw new Error("Enter a file name");

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      const fileId = `demo-priority-file-${Date.now()}`;
      const category = state.taskCategories?.find((c) => c.id === categoryId)?.name || "Uncategorized";
      const createdAt = new Date().toISOString();
      const assignmentId = `${fileId}-0`;
      (sd.taskFiles ??= []).push({ id: fileId, fileName, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: [{ id: assignmentId, taskFileId: fileId, categoryId, category, status: "In Progress", vaAssigned: ["Jane"], sortOrder: 0, createdAt }] });
      (sd.tasks ??= []).push({ id: assignmentId, category, fileName, sortOrder: sd.taskFiles.length - 1, status: "In Progress", vaAssigned: ["Jane"], createdAt });
      state.planItems = (state.planItems || []).filter((p) => p.id !== id);
    });
    revalidatePath("/overview");
    revalidatePath(`/schools/${schoolId}`);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const fileId = crypto.randomUUID();
  const { error: createError } = await supabase.rpc("add_task_file", { p_id: fileId, p_school_id: schoolId, p_file_name: fileName, p_category_ids: [categoryId] });
  orThrow(createError);

  const { data: created } = await supabase.from("task_file_categories").select("id").eq("task_file_id", fileId).eq("category_id", categoryId).maybeSingle();
  if (!created) throw new Error("Task was created but could not be started — open the school page to sign it manually.");

  const { error: startError } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: created.id, p_patch: { status: "In Progress", va_assigned: [me.name] } });
  orThrow(startError);

  await supabase.from("plan_items").delete().eq("id", id);
  revalidatePath("/overview");
  revalidatePath(`/schools/${schoolId}`);
}

/* "Start a New Day" -- opens the floating plan bubble for this VA on
   every page by setting a per-VA cookie the layout checks (see
   app/(app)/layout.tsx). No other state changes: the bubble's actual
   content is always just this VA's current pending plan_items rows. */
export async function startNewDay() {
  const { me } = await requireTeamMember();
  (await cookies()).set(`plan-bubble-open-${me.id}`, "1", { maxAge: 60 * 60 * 24 });
  revalidatePath("/overview");
}
