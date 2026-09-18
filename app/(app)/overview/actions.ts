"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { isAdmin } from "@/lib/app-state";
import { diffPlanSelection } from "@/lib/shared-task-files";

type PlanActionResult = { error: string | null };

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function requireAdmin() {
  const { supabase, me } = await requireTeamMember();
  if (!isAdmin(me)) throw new Error("Not authorized");
  return { supabase, me };
}

/* Thrown errors inside a Server Action get redacted to a generic
   "Minified React error #441" in production (React/Next.js's
   safety default for anything NOT explicitly returned as data) --
   every mutation here goes through this so a real failure reaches the
   client's error UI intact instead of vanishing into that redaction.
   TODO once the current daily-plan rollout stabilizes: switch to a
   fixed safe message here (matching lib/shared-task-files.ts's
   saveTaskFile()) instead of forwarding the raw DB error text. */
async function runPlanAction(operation: () => Promise<void>): Promise<PlanActionResult> {
  try {
    await operation();
    return { error: null };
  } catch (error) {
    console.error("Daily plan action failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }
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
export async function savePlan(formData: FormData): Promise<PlanActionResult> {
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
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    const { data: existingRows, error: selectError } = await supabase.from("plan_items").select("id, task_file_category_id, general_task_id").eq("kind", "task").eq("va_name", me.name);
    orThrow(selectError);
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
  });
}

/* Boss-only: add a priority, either freeform or linked to a real file
   (school + category + file name) so PlanPriorityStartForm can later
   pre-fill the Start picker instead of starting blank. Linking is
   metadata only -- `label` is still what displays everywhere, and the
   VA can still change the picker before submitting Start. Optionally
   targeted at one VA (leave assignedTo blank for a shared/unassigned
   item anyone can claim). */
export async function addPriority(formData: FormData): Promise<PlanActionResult> {
  const label = ((formData.get("label") as string) || "").trim();
  const assignedTo = ((formData.get("assignedTo") as string) || "").trim() || undefined;
  const suggestedSchoolId = ((formData.get("suggestedSchoolId") as string) || "").trim() || undefined;
  const suggestedCategoryId = ((formData.get("suggestedCategoryId") as string) || "").trim() || undefined;
  const suggestedFileName = ((formData.get("suggestedFileName") as string) || "").trim() || undefined;
  if (!label) return { error: "Enter what should be worked on." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.planItems ??= []).push({
        id: `demo-priority-${Date.now()}`,
        kind: "priority",
        vaName: assignedTo,
        label,
        createdBy: "Jane",
        createdAt: new Date().toISOString(),
        suggestedSchoolId,
        suggestedCategoryId,
        suggestedFileName,
      });
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireAdmin();
    const { error } = await supabase.from("plan_items").insert({
      kind: "priority",
      va_name: assignedTo ?? null,
      label,
      created_by: me.name,
      suggested_school_id: suggestedSchoolId ?? null,
      suggested_category_id: suggestedCategoryId ?? null,
      suggested_file_name: suggestedFileName ?? null,
    });
    orThrow(error);
    revalidatePath("/overview");
  });
}

/* Any VA can claim an unassigned/shared priority for themselves --
   matches this app's existing "no per-row ownership" trust model.
   Guarded with .is("va_name", null) so two VAs racing to claim the
   same item can't both succeed: the loser's update just matches zero
   rows and its next revalidate shows the item already gone from the
   unassigned list. Once claimed, the item has a vaName and shows up
   in that VA's own Plans for Tomorrow section instead. */
export async function claimPriorityPlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = (state.planItems || []).find((p) => p.id === id && p.kind === "priority" && !p.vaName);
      if (item) item.vaName = "Jane";
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("plan_items").update({ va_name: me.name }).eq("id", id).eq("kind", "priority").is("va_name", null);
    orThrow(error);
    revalidatePath("/overview");
  });
}

/* Either VA can remove any pending plan item -- matches this app's
   existing team-wide trust model (no per-row ownership enforcement
   anywhere else either, see plan_items' own RLS policy).

   A claimed priority (kind:"priority" with a vaName) is the one
   exception: removing it from Plans for Tomorrow doesn't delete the
   row, it just clears vaName back to null -- Michelle asked for a
   claimed-then-abandoned priority to go back to Task Priorities'
   unassigned list for someone else to claim, not disappear entirely.
   This same function is also how an UNCLAIMED priority gets removed
   directly from Task Priorities (its own ✕ button) -- there vaName is
   already null, so that case still falls through to a real delete,
   same as every other kind. */
export async function removePlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = (state.planItems || []).find((p) => p.id === id);
      if (item && item.kind === "priority" && item.vaName) {
        item.vaName = undefined;
      } else {
        state.planItems = (state.planItems || []).filter((p) => p.id !== id);
      }
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase } = await requireTeamMember();
    const { data: item } = await supabase.from("plan_items").select("kind, va_name").eq("id", id).maybeSingle();
    if (item && item.kind === "priority" && item.va_name) {
      const { error } = await supabase.from("plan_items").update({ va_name: null }).eq("id", id);
      orThrow(error);
    } else {
      const { error } = await supabase.from("plan_items").delete().eq("id", id);
      orThrow(error);
    }
    revalidatePath("/overview");
  });
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
export async function resolveTaskPlanItem(formData: FormData): Promise<PlanActionResult> {
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
    return { error: null };
  }

  return runPlanAction(async () => {
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
  });
}

/* "Start my day" -- pauses every task this VA currently has In
   Progress (school tasks + General Tasks) and makes sure each one has
   a kind:"task" plan_items row waiting in Your Plan, so nothing gets
   stranded Paused with no way back except the status dropdown. A VA
   with nothing In Progress gets a silent no-op (no writes, no
   revalidate) -- this also makes a second click harmless. Only
   `status` is patched via update_task_assignment's p_patch -- leaving
   va_assigned out of the patch leaves it untouched (confirmed in
   supabase/phase41_selective_table_categories.sql's `p_patch ? 'key'`
   guards), so this never touches who's assigned, just the shared
   status field. Known limitation, accepted by Michelle: status is one
   field per task row, not per-VA, so a task shared with another VA
   pauses for them too. */
export async function startMyDay(): Promise<PlanActionResult> {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const existingTaskRefs = new Set(
        (state.planItems || []).filter((p) => p.kind === "task" && p.vaName === "Jane").map((p) => p.taskFileCategoryId || p.generalTaskId)
      );
      for (const school of state.schools) {
        const sd = state.schoolData[school.id];
        for (const assignment of sd?.taskFiles?.flatMap((f) => f.categories) || []) {
          if (assignment.status !== "In Progress" || !assignment.vaAssigned.includes("Jane")) continue;
          assignment.status = "Paused";
          const task = sd?.tasks?.find((t) => t.id === assignment.id);
          if (task) task.status = "Paused";
          if (!existingTaskRefs.has(assignment.id)) {
            const fileName = sd?.taskFiles?.find((f) => f.categories.some((c) => c.id === assignment.id))?.fileName || "Task";
            (state.planItems ??= []).push({ id: `demo-startday-${assignment.id}`, kind: "task", vaName: "Jane", schoolId: school.id, taskFileCategoryId: assignment.id, label: `${fileName} — ${assignment.category}`, createdBy: "Jane", createdAt: new Date().toISOString() });
          }
        }
      }
      for (const task of state.generalTasks || []) {
        if (task.status !== "In Progress" || !task.vaAssigned.includes("Jane")) continue;
        task.status = "Paused";
        if (!existingTaskRefs.has(task.id)) {
          (state.planItems ??= []).push({ id: `demo-startday-${task.id}`, kind: "task", vaName: "Jane", generalTaskId: task.id, label: `${task.description} — ${task.category}`, createdBy: "Jane", createdAt: new Date().toISOString() });
        }
      }
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    const { data: assignments, error: assignmentsError } = await supabase
      .from("task_file_categories")
      .select("id, task_file_id, category_id")
      .eq("status", "In Progress")
      .contains("va_assigned", [me.name]);
    orThrow(assignmentsError);

    const { data: generalTasks, error: generalError } = await supabase
      .from("general_tasks")
      .select("id, category, description")
      .eq("status", "In Progress")
      .contains("va_assigned", [me.name]);
    orThrow(generalError);

    if ((assignments || []).length === 0 && (generalTasks || []).length === 0) return;

    const { data: existingPlanRows, error: existingError } = await supabase
      .from("plan_items")
      .select("task_file_category_id, general_task_id")
      .eq("kind", "task")
      .eq("va_name", me.name);
    orThrow(existingError);
    const existingRefs = new Set((existingPlanRows || []).map((r) => r.task_file_category_id || r.general_task_id));

    const touchedSchoolIds = new Set<string>();
    const newPlanRows: { kind: "task"; va_name: string; school_id?: string; task_file_category_id?: string; general_task_id?: string; label: string; created_by: string }[] = [];

    if ((assignments || []).length > 0) {
      const fileIds = [...new Set((assignments || []).map((a) => a.task_file_id))];
      const categoryIds = [...new Set((assignments || []).map((a) => a.category_id))];
      const { data: files, error: filesError } = await supabase.from("task_files").select("id, file_name, school_id").in("id", fileIds);
      orThrow(filesError);
      const { data: categories, error: categoriesError } = await supabase.from("task_categories").select("id, name").in("id", categoryIds);
      orThrow(categoriesError);
      const fileById = new Map((files || []).map((f) => [f.id, f]));
      const categoryById = new Map((categories || []).map((c) => [c.id, c.name]));

      for (const assignment of assignments || []) {
        const file = fileById.get(assignment.task_file_id);
        if (!file) continue;
        touchedSchoolIds.add(file.school_id);
        const { error } = await supabase.rpc("update_task_assignment", { p_school_id: file.school_id, p_task_id: assignment.id, p_patch: { status: "Paused" } });
        orThrow(error);
        if (!existingRefs.has(assignment.id)) {
          const categoryName = categoryById.get(assignment.category_id) || "";
          newPlanRows.push({ kind: "task", va_name: me.name, school_id: file.school_id, task_file_category_id: assignment.id, label: `${file.file_name} — ${categoryName}`, created_by: me.name });
        }
      }
    }

    for (const task of generalTasks || []) {
      const { error } = await supabase.from("general_tasks").update({ status: "Paused" }).eq("id", task.id);
      orThrow(error);
      if (!existingRefs.has(task.id)) {
        newPlanRows.push({ kind: "task", va_name: me.name, general_task_id: task.id, label: `${task.description} — ${task.category}`, created_by: me.name });
      }
    }

    if (newPlanRows.length > 0) {
      const { error } = await supabase.from("plan_items").insert(newPlanRows);
      orThrow(error);
    }

    revalidatePath("/overview");
    for (const schoolId of touchedSchoolIds) revalidatePath(`/schools/${schoolId}`);
    if ((generalTasks || []).length > 0) revalidatePath("/general-tasks");
  });
}

/* Resolve a kind:"priority" item -- creates the real task (school +
   category + file name, reusing add_task_file), signs the VA, sets it
   In Progress, then deletes the plan_items row. */
export async function resolvePriorityPlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;
  const destination = (formData.get("destination") as string) || "school";
  const schoolId = (formData.get("schoolId") as string) || "";
  const categoryId = formData.get("categoryId") as string;
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return { error: "Enter a file name" };

  if (destination === "general") {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        (state.generalTasks ??= []).push({ id: `demo-priority-general-${Date.now()}`, category: categoryId, description: fileName, status: "In Progress", vaAssigned: ["Jane"], createdAt: new Date().toISOString() });
        state.planItems = (state.planItems || []).filter((p) => p.id !== id);
      });
      revalidatePath("/overview");
      revalidatePath("/general-tasks");
      return { error: null };
    }

    return runPlanAction(async () => {
      const { supabase, me } = await requireTeamMember();
      const { error } = await supabase.from("general_tasks").insert({ id: crypto.randomUUID(), category: categoryId, description: fileName, status: "In Progress", va_assigned: [me.name] });
      orThrow(error);
      await supabase.from("plan_items").delete().eq("id", id);
      revalidatePath("/overview");
      revalidatePath("/general-tasks");
    });
  }

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
    return { error: null };
  }

  return runPlanAction(async () => {
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
  });
}
