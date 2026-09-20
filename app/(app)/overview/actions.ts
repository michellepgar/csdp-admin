"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { isAdmin } from "@/lib/app-state";
import { diffPlanSelection } from "@/lib/shared-task-files";
import { MAX_WORK_NOTE, parseNoteKey } from "@/lib/work-notes";
import { comparePriorities, movePriorityId } from "@/lib/plan-order";
import { shiftAvailability } from "@/lib/shift";

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

/* Tells a VA a Task Priority was assigned to them -- one row in the same
   `mentions` table the bell already reads (source "priority_assignment",
   the priority's label as the snippet; see
   supabase/phase52_priority_assignment_notifications.sql). */
async function notifyPriorityAssigned(
  supabase: Awaited<ReturnType<typeof requireTeamMember>>["supabase"],
  assignee: string,
  assigner: string,
  label: string,
) {
  const { error } = await supabase.from("mentions").insert({
    id: crypto.randomUUID(),
    mentioned_name: assignee,
    mentioner_name: assigner,
    source: "priority_assignment",
    snippet: label,
  });
  orThrow(error);
}

function pushDemoAssignmentNotice(state: import("@/lib/app-state").AppState, assignee: string, label: string) {
  (state.mentions ??= []).push({
    id: `demo-${Date.now()}-${assignee}`,
    mentionedName: assignee,
    mentionerName: "Jane",
    source: "priority_assignment",
    snippet: label,
    createdAt: new Date().toISOString(),
  });
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
  // Reminders to add as fresh, pending kind:"note" plan_items -- either
  // a today's-reminder being carried into the next shift, or a brand
  // new one (free text, or copied from a private note flagged as a
  // reminder). Unlike taskFileCategoryIds/generalTaskIds above, these
  // are never diffed against anything existing -- every entry here is
  // always a new row (End Today's Work's own reminder tab only ever
  // stages ones that aren't already pending).
  const remindersJson = formData.get("reminders") as string;
  const reminders: { label: string; noteId?: string }[] = remindersJson ? JSON.parse(remindersJson) : [];
  // Files/tasks/categories typed into the planning window that don't exist
  // yet. They're created here, only when the plan is actually saved.
  const newItemsJson = formData.get("newItems") as string;
  const newItems: { kind: "school" | "general"; schoolId?: string; categoryId?: string; tableId?: string; categoryIds?: string[]; categoryName: string; isNewCategory: boolean; name: string }[] = newItemsJson ? JSON.parse(newItemsJson) : [];
  // Set by the End Today's Work window (not by the plain "Add" on Next
  // Shift Plan): saving the plan also closes the shift.
  const endShift = formData.get("endShift") === "1";

  if (await isDemoMode()) {
    let demoError: string | null = null;
    await demoMutate((state) => {
      if (endShift && !shiftAvailability(state.shiftStates, "Jane").canEnd) {
        demoError = "You haven't started your day yet. Click Start my day first.";
        return;
      }
      if (endShift) state.shiftStates = [...(state.shiftStates || []).filter((s) => s.vaName !== "Jane"), { vaName: "Jane", status: "ended", changedAt: new Date().toISOString() }];
      for (const [index, item] of newItems.entries()) {
        const name = item.name.trim();
        const categoryName = item.categoryName.trim();
        if (!name || !categoryName) continue;
        const stamp = `${Date.now()}-${index}`;
        const createdAt = new Date().toISOString();
        if (item.kind === "general") {
          if (item.isNewCategory && !(state.generalTaskCategories || []).some((c) => c.name.toLowerCase() === categoryName.toLowerCase())) {
            (state.generalTaskCategories ??= []).push({ id: `demo-gcat-${stamp}`, name: categoryName });
          }
          const id = `demo-gen-${stamp}`;
          (state.generalTasks ??= []).push({ id, category: categoryName, description: name, status: "", vaAssigned: [], createdAt });
          checkedGeneralIds.push(id);
          labels[id] = { label: `${name} — ${categoryName}` };
        } else if (item.schoolId && item.tableId && item.categoryIds?.length) {
          const sd = (state.schoolData[item.schoolId] ??= { vaAssigned: "" });
          const fileId = `demo-file-${stamp}`;
          const assignments = item.categoryIds.map((categoryId, i) => ({
            id: `${fileId}-${i}`, taskFileId: fileId, categoryId,
            category: state.taskCategories?.find((c) => c.id === categoryId)?.name || "Uncategorized",
            status: "", vaAssigned: [] as string[], sortOrder: i, createdAt,
          }));
          (sd.taskFiles ??= []).push({ id: fileId, tableId: item.tableId, fileName: name, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: assignments });
          for (const a of assignments) {
            (sd.tasks ??= []).push({ id: a.id, category: a.category, fileName: name, sortOrder: sd.taskFiles.length - 1, status: "", vaAssigned: [], createdAt });
            checkedTaskIds.push(a.id);
            labels[a.id] = { label: `${name} — ${a.category}`, schoolId: item.schoolId };
          }
        } else if (item.schoolId) {
          let categoryId = item.categoryId;
          if (item.isNewCategory) {
            const found = (state.taskCategories || []).find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
            categoryId = found?.id ?? `demo-cat-${stamp}`;
            if (!found) (state.taskCategories ??= []).push({ id: categoryId, name: categoryName });
          }
          if (!categoryId) continue;
          const sd = (state.schoolData[item.schoolId] ??= { vaAssigned: "" });
          const fileId = `demo-file-${stamp}`;
          const assignmentId = `${fileId}-0`;
          (sd.taskFiles ??= []).push({ id: fileId, fileName: name, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: [{ id: assignmentId, taskFileId: fileId, categoryId, category: categoryName, status: "", vaAssigned: [], sortOrder: 0, createdAt }] });
          (sd.tasks ??= []).push({ id: assignmentId, category: categoryName, fileName: name, sortOrder: sd.taskFiles.length - 1, status: "", vaAssigned: [], createdAt });
          checkedTaskIds.push(assignmentId);
          labels[assignmentId] = { label: `${name} — ${categoryName}`, schoolId: item.schoolId };
        }
      }
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
      for (const [i, reminder] of reminders.entries()) {
        state.planItems.push({ id: `demo-reminder-${Date.now()}-${i}`, kind: "note", vaName: "Jane", noteId: reminder.noteId, label: reminder.label, createdBy: "Jane", createdAt: new Date().toISOString() });
      }
    });
    revalidatePath("/overview");
    return { error: demoError };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    if (endShift) {
      const { data: shiftRows, error: shiftError } = await supabase.from("shift_state").select("va_name, status, changed_at").eq("va_name", me.name);
      orThrow(shiftError);
      const states = (shiftRows || []).map((r) => ({ vaName: r.va_name, status: r.status as "working" | "ended", changedAt: r.changed_at }));
      if (!shiftAvailability(states, me.name).canEnd) throw new Error("You haven't started your day yet. Click Start my day first.");
    }

    const touchedSchoolIds = new Set<string>();
    for (const item of newItems) {
      const name = item.name.trim();
      const categoryName = item.categoryName.trim();
      if (!name || !categoryName) continue;

      if (item.kind === "general") {
        if (item.isNewCategory) {
          const { data: existingCategory, error: categoryLookupError } = await supabase.from("general_task_categories").select("id").ilike("name", categoryName).maybeSingle();
          orThrow(categoryLookupError);
          if (!existingCategory) {
            const { data: maxRow } = await supabase.from("general_task_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
            const { error } = await supabase.from("general_task_categories").insert({ id: crypto.randomUUID(), name: categoryName, sort_order: (maxRow?.sort_order ?? -1) + 1 });
            orThrow(error);
          }
        }
        const { data: existingTask, error: taskLookupError } = await supabase.from("general_tasks").select("id").eq("category", categoryName).ilike("description", name).maybeSingle();
        orThrow(taskLookupError);
        let taskId = existingTask?.id as string | undefined;
        if (!taskId) {
          taskId = crypto.randomUUID();
          const { error } = await supabase.from("general_tasks").insert({ id: taskId, category: categoryName, description: name, status: "", va_assigned: [] });
          orThrow(error);
        }
        checkedGeneralIds.push(taskId);
        labels[taskId] = { label: `${name} — ${categoryName}` };
        continue;
      }

      if (!item.schoolId) continue;

      if (item.tableId && item.categoryIds?.length) {
        const { data: tableCategories, error: tableCategoriesError } = await supabase.from("task_categories").select("id, name").in("id", item.categoryIds);
        orThrow(tableCategoriesError);
        const categoryNameById = new Map((tableCategories || []).map((c) => [c.id as string, c.name as string]));
        const { data: sameNameFiles, error: sameNameError } = await supabase
          .from("task_files")
          .select("id, task_file_categories(id, category_id)")
          .eq("school_id", item.schoolId)
          .eq("table_id", item.tableId)
          .ilike("file_name", name);
        orThrow(sameNameError);
        let assignmentRows = (sameNameFiles || []).flatMap((f) => f.task_file_categories);
        if (assignmentRows.length === 0) {
          const fileId = crypto.randomUUID();
          const { error: createError } = await supabase.rpc("add_task_file", { p_id: fileId, p_school_id: item.schoolId, p_file_name: name, p_category_ids: item.categoryIds });
          orThrow(createError);
          // Keep it in the table it was added to (a table is identified by its table_id).
          const { error: tableError } = await supabase.from("task_files").update({ table_id: item.tableId }).eq("id", fileId).eq("school_id", item.schoolId);
          orThrow(tableError);
          const { data: created, error: createdError } = await supabase.from("task_file_categories").select("id, category_id").eq("task_file_id", fileId);
          orThrow(createdError);
          assignmentRows = created || [];
          touchedSchoolIds.add(item.schoolId);
        }
        if (assignmentRows.length === 0) throw new Error("The new file was created but couldn't be added to your plan. Open the school page to find it.");
        for (const row of assignmentRows) {
          checkedTaskIds.push(row.id as string);
          labels[row.id as string] = { label: `${name} — ${categoryNameById.get(row.category_id as string) || item.categoryName}`, schoolId: item.schoolId };
        }
        continue;
      }

      let categoryId = item.categoryId;
      if (item.isNewCategory) {
        const { data: existingCategory, error: categoryLookupError } = await supabase.from("task_categories").select("id").is("school_id", null).ilike("name", categoryName).maybeSingle();
        orThrow(categoryLookupError);
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          const { data: maxRow } = await supabase.from("task_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
          categoryId = crypto.randomUUID();
          const { error } = await supabase.from("task_categories").insert({ id: categoryId, name: categoryName, sort_order: (maxRow?.sort_order ?? -1) + 1 });
          orThrow(error);
        }
      }
      if (!categoryId) continue;

      const { data: existingFiles, error: fileLookupError } = await supabase
        .from("task_files")
        .select("id, task_file_categories(id, category_id)")
        .eq("school_id", item.schoolId)
        .ilike("file_name", name);
      orThrow(fileLookupError);
      let assignmentId = (existingFiles || []).flatMap((f) => f.task_file_categories).find((a) => a.category_id === categoryId)?.id as string | undefined;
      if (!assignmentId) {
        const fileId = crypto.randomUUID();
        const { error: createError } = await supabase.rpc("add_task_file", { p_id: fileId, p_school_id: item.schoolId, p_file_name: name, p_category_ids: [categoryId] });
        orThrow(createError);
        const { data: created, error: createdError } = await supabase.from("task_file_categories").select("id").eq("task_file_id", fileId).eq("category_id", categoryId).maybeSingle();
        orThrow(createdError);
        if (!created) throw new Error("The new file was created but couldn't be added to your plan. Open the school page to find it.");
        assignmentId = created.id;
        touchedSchoolIds.add(item.schoolId);
      }
      checkedTaskIds.push(assignmentId!);
      labels[assignmentId!] = { label: `${name} — ${categoryName}`, schoolId: item.schoolId };
    }

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
      ...reminders.map((r) => ({ kind: "note" as const, va_name: me.name, note_id: r.noteId ?? null, label: r.label, created_by: me.name })),
    ];
    if (rows.length > 0) {
      const { error } = await supabase.from("plan_items").insert(rows);
      orThrow(error);
    }
    if (endShift) {
      const { error } = await supabase.from("shift_state").upsert({ va_name: me.name, status: "ended", changed_at: new Date().toISOString() }, { onConflict: "va_name" });
      orThrow(error);
    }
    revalidatePath("/overview");
    for (const schoolId of touchedSchoolIds) revalidatePath(`/schools/${schoolId}`);
    if (newItems.some((i) => i.kind === "general")) revalidatePath("/general-tasks");
    if (newItems.some((i) => i.isNewCategory)) revalidatePath("/", "layout");
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
  if (suggestedCategoryId && !suggestedFileName) return { error: "Choose or add a file name." };

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
      if (assignedTo && assignedTo !== "Jane") pushDemoAssignmentNotice(state, assignedTo, label);
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
    if (assignedTo && assignedTo !== me.name) await notifyPriorityAssigned(supabase, assignedTo, me.name, label);
    revalidatePath("/overview");
  });
}

/* Boss-only: edit an existing priority's own fields in place -- same
   fields addPriority accepts, since editing is just "add" with an id
   instead of an insert. Scoped to kind:"priority" so this can never be
   pointed at a kind:"task"/"note" row by id. */
export async function updatePriorityPlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;
  const label = ((formData.get("label") as string) || "").trim();
  const assignedTo = ((formData.get("assignedTo") as string) || "").trim() || undefined;
  const suggestedSchoolId = ((formData.get("suggestedSchoolId") as string) || "").trim() || undefined;
  const suggestedCategoryId = ((formData.get("suggestedCategoryId") as string) || "").trim() || undefined;
  const suggestedFileName = ((formData.get("suggestedFileName") as string) || "").trim() || undefined;
  if (!label) return { error: "Enter what should be worked on." };
  if (suggestedCategoryId && !suggestedFileName) return { error: "Choose or add a file name." };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = (state.planItems || []).find((p) => p.id === id && p.kind === "priority");
      if (!item) return;
      const previousAssignee = item.vaName;
      item.label = label;
      item.vaName = assignedTo;
      if (assignedTo && assignedTo !== previousAssignee && assignedTo !== "Jane") pushDemoAssignmentNotice(state, assignedTo, label);
      item.suggestedSchoolId = suggestedSchoolId;
      item.suggestedCategoryId = suggestedCategoryId;
      item.suggestedFileName = suggestedFileName;
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireAdmin();
    const { data: existing } = await supabase.from("plan_items").select("va_name").eq("id", id).eq("kind", "priority").maybeSingle();
    const { error } = await supabase
      .from("plan_items")
      .update({
        label,
        va_name: assignedTo ?? null,
        suggested_school_id: suggestedSchoolId ?? null,
        suggested_category_id: suggestedCategoryId ?? null,
        suggested_file_name: suggestedFileName ?? null,
      })
      .eq("id", id)
      .eq("kind", "priority");
    orThrow(error);
    // Only a NEW assignee gets told -- re-saving an edit that leaves the
    // same person assigned doesn't re-notify them.
    if (existing && assignedTo && assignedTo !== existing.va_name && assignedTo !== me.name) {
      await notifyPriorityAssigned(supabase, assignedTo, me.name, label);
    }
    revalidatePath("/overview");
  });
}

/* Admins move an unassigned priority one step up or down in Task
   Priorities. Every unassigned priority is renumbered 0..n in its current
   order first, so priorities that were never ordered get a stable place. */
export async function movePriorityPlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;
  const direction = formData.get("direction") === "up" ? "up" : "down";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const shared = (state.planItems || []).filter((p) => p.kind === "priority" && !p.vaName);
      const ids = movePriorityId(shared, id, direction);
      if (!ids) return;
      ids.forEach((itemId, index) => {
        const item = shared.find((p) => p.id === itemId);
        if (item) item.sortOrder = index;
      });
    });
    revalidatePath("/overview");
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from("plan_items")
      .select("id, created_at, sort_order")
      .eq("kind", "priority")
      .is("va_name", null);
    orThrow(error);
    const shared = (data || []).map((r) => ({ id: r.id, kind: "priority" as const, label: "", createdBy: "", createdAt: r.created_at, sortOrder: r.sort_order ?? undefined }));
    const ids = movePriorityId(shared.sort(comparePriorities), id, direction);
    if (!ids) return;
    for (const [index, itemId] of ids.entries()) {
      const { error: updateError } = await supabase.from("plan_items").update({ sort_order: index }).eq("id", itemId);
      orThrow(updateError);
    }
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

/* An UNCLAIMED item (no vaName -- only ever a shared priority sitting
   in Task Priorities) can be removed by anyone, same as this app's
   existing team-wide trust model everywhere else. But once an item has
   a vaName -- it's on someone's own Plans for Tomorrow -- only that VA
   can remove it; Michelle asked for this specifically so one person
   can't clear another's plan out from under them.

   A claimed priority (kind:"priority" with a vaName) removed by its
   own VA doesn't delete the row, it just clears vaName back to null --
   Michelle asked for a claimed-then-abandoned priority to go back to
   Task Priorities' unassigned list for someone else to claim, not
   disappear entirely. */
export async function removePlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    return runPlanAction(async () => {
      await demoMutate((state) => {
        const item = (state.planItems || []).find((p) => p.id === id);
        if (!item) return;
        if (item.vaName && item.vaName !== "Jane") throw new Error("You can only remove items from your own plan.");
        if (item.kind === "priority" && item.vaName) {
          item.vaName = undefined;
        } else {
          state.planItems = (state.planItems || []).filter((p) => p.id !== id);
        }
      });
      revalidatePath("/overview");
    });
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();
    const { data: item } = await supabase.from("plan_items").select("kind, va_name").eq("id", id).maybeSingle();
    if (!item) return;
    if (item.va_name && item.va_name !== me.name) throw new Error("You can only remove items from your own plan.");
    if (item.kind === "priority" && item.va_name) {
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
          assignment.vaAssigned = ["Jane"];
          assignment.status = assignment.status === "Completed" ? "Review" : "In Progress";
          const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskFileCategoryId);
          if (task) { task.vaAssigned = ["Jane"]; task.status = assignment.status; }
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
      // One VA per file: starting it puts you on it in place of whoever was.
      const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: taskFileCategoryId, p_patch: { status: nextStatus, va_assigned: [me.name] } });
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
    let demoError: string | null = null;
    await demoMutate((state) => {
      if (!shiftAvailability(state.shiftStates, "Jane").canStart) {
        demoError = "You're already in a shift. Click End Today's Work first.";
        return;
      }
      state.shiftStates = [...(state.shiftStates || []).filter((s) => s.vaName !== "Jane"), { vaName: "Jane", status: "working", changedAt: new Date().toISOString() }];
      const doneIds = new Set((state.planItems || []).filter((p) => p.kind !== "task" && p.vaName === "Jane" && p.completedAt).map((p) => p.id));
      state.planItems = (state.planItems || []).filter((p) => !doneIds.has(p.id));
      state.workNotes = (state.workNotes || []).filter((n) => !(n.vaName === "Jane" && doneIds.has(n.itemKey.replace(/^p:/, ""))));
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
    return { error: demoError };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    const { data: shiftRows, error: shiftError } = await supabase.from("shift_state").select("va_name, status, changed_at").eq("va_name", me.name);
    orThrow(shiftError);
    const states = (shiftRows || []).map((r) => ({ vaName: r.va_name, status: r.status as "working" | "ended", changedAt: r.changed_at }));
    if (!shiftAvailability(states, me.name).canStart) throw new Error("You're already in a shift. Click End Today's Work first.");

    // A fresh day: reminders already checked off (shown as "✓ Reviewed")
    // are done with -- clear them, and their notes, from Today.
    const { data: doneReminders, error: doneError } = await supabase
      .from("plan_items")
      .select("id")
      .eq("va_name", me.name)
      .neq("kind", "task")
      .not("completed_at", "is", null);
    orThrow(doneError);
    if ((doneReminders || []).length > 0) {
      const ids = doneReminders!.map((r) => r.id);
      const { error: notesError } = await supabase.from("work_notes").delete().eq("va_name", me.name).in("item_key", ids.map((id) => `p:${id}`));
      orThrow(notesError);
      const { error: deleteError } = await supabase.from("plan_items").delete().in("id", ids);
      orThrow(deleteError);
      revalidatePath("/overview");
    }

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

    const { error: shiftUpsertError } = await supabase.from("shift_state").upsert({ va_name: me.name, status: "working", changed_at: new Date().toISOString() }, { onConflict: "va_name" });
    orThrow(shiftUpsertError);

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
   In Progress, then deletes the plan_items row. A priority that's just
   a heads-up with no real task behind it (e.g. "keep an eye on the
   front desk today") can instead be resolved as a plain reminder --
   same completed_at convention private-note reminders already use
   (see completeNoteReminder in app/(app)/private-notes/actions.ts):
   the row is marked done, not deleted or turned into a task, so it can
   still show up on Today (lib/shared-task-files.ts's
   todayActivityByVa). */
export async function resolvePriorityPlanItem(formData: FormData): Promise<PlanActionResult> {
  const id = formData.get("id") as string;
  const destination = (formData.get("destination") as string) || "school";
  const schoolId = (formData.get("schoolId") as string) || "";
  const categoryId = formData.get("categoryId") as string;
  const fileName = ((formData.get("fileName") as string) || "").trim();

  if (destination === "reminder") {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const item = (state.planItems || []).find((p) => p.id === id && p.kind === "priority");
        if (item) item.completedAt = new Date().toISOString();
      });
      revalidatePath("/overview");
      return { error: null };
    }
    return runPlanAction(async () => {
      const { supabase } = await requireTeamMember();
      const { error } = await supabase.from("plan_items").update({ completed_at: new Date().toISOString() }).eq("id", id).eq("kind", "priority");
      orThrow(error);
      revalidatePath("/overview");
    });
  }
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

  /* The file name suggested when linking a priority is now picked from
     REAL existing files under that school+category (task-priorities.tsx),
     so the common case here is "start this existing file's task", not
     "create a new one" -- creating a new file at the same name+category
     would just fail the unique-name constraint add_task_file already
     enforces. Match by trimmed/case-insensitive name (same normalization
     add_task_file itself uses) and, if found, sign/start that existing
     assignment instead -- same status logic resolveTaskPlanItem already
     uses (Review if already Completed, In Progress otherwise). Only
     falls through to creating a brand-new file when no match exists
     (the VA typed a genuinely new name, or the picker's "+ Add new
     file" path was used). */
  const normalizedFileName = fileName.trim().toLowerCase();

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      const existingFile = (sd.taskFiles || []).find((f) => f.fileName.trim().toLowerCase() === normalizedFileName && f.categories.some((c) => c.categoryId === categoryId));
      const existingAssignment = existingFile?.categories.find((c) => c.categoryId === categoryId);
      if (existingAssignment) {
        existingAssignment.vaAssigned = ["Jane"];
        existingAssignment.status = existingAssignment.status === "Completed" ? "Review" : "In Progress";
        const task = sd.tasks?.find((t) => t.id === existingAssignment.id);
        if (task) { task.vaAssigned = ["Jane"]; task.status = existingAssignment.status; }
      } else {
        const fileId = `demo-priority-file-${Date.now()}`;
        const category = state.taskCategories?.find((c) => c.id === categoryId)?.name || "Uncategorized";
        const createdAt = new Date().toISOString();
        const assignmentId = `${fileId}-0`;
        (sd.taskFiles ??= []).push({ id: fileId, fileName, sortOrder: sd.taskFiles?.length || 0, createdAt, categories: [{ id: assignmentId, taskFileId: fileId, categoryId, category, status: "In Progress", vaAssigned: ["Jane"], sortOrder: 0, createdAt }] });
        (sd.tasks ??= []).push({ id: assignmentId, category, fileName, sortOrder: sd.taskFiles.length - 1, status: "In Progress", vaAssigned: ["Jane"], createdAt });
      }
      state.planItems = (state.planItems || []).filter((p) => p.id !== id);
    });
    revalidatePath("/overview");
    revalidatePath(`/schools/${schoolId}`);
    return { error: null };
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    const { data: existingFiles } = await supabase
      .from("task_files")
      .select("id, task_file_categories(id, status, va_assigned, category_id)")
      .eq("school_id", schoolId)
      .ilike("file_name", fileName.trim());
    const existingAssignment = (existingFiles || [])
      .flatMap((f) => f.task_file_categories)
      .find((a) => a.category_id === categoryId);

    if (existingAssignment) {
      const nextStatus = existingAssignment.status === "Completed" ? "Review" : "In Progress";
      // One VA per file: starting it puts you on it in place of whoever was.
      const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: existingAssignment.id, p_patch: { status: nextStatus, va_assigned: [me.name] } });
      orThrow(error);
    } else {
      const fileId = crypto.randomUUID();
      const { error: createError } = await supabase.rpc("add_task_file", { p_id: fileId, p_school_id: schoolId, p_file_name: fileName, p_category_ids: [categoryId] });
      orThrow(createError);

      const { data: created } = await supabase.from("task_file_categories").select("id").eq("task_file_id", fileId).eq("category_id", categoryId).maybeSingle();
      if (!created) throw new Error("Task was created but could not be started — open the school page to sign it manually.");

      const { error: startError } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: created.id, p_patch: { status: "In Progress", va_assigned: [me.name] } });
      orThrow(startError);
    }

    await supabase.from("plan_items").delete().eq("id", id);
    revalidatePath("/overview");
    revalidatePath(`/schools/${schoolId}`);
  });
}

/* Add, change or remove YOUR OWN note on a task or reminder (Currently
   Working On, Next Shift Plan, Your Plan). A note is only an explanation
   -- it never changes the task, priority or reminder it sits on, so the
   boss's assignments stay exactly as set. Empty text removes the note.

   Only your own work: a school/general task must be one you're signed on
   to, a plan item must be on your own plan, and the note is always filed
   under your name. The database enforces the same (see
   supabase/phase59_work_notes.sql); this check just gives a clear message. */
/* The check button on your own task in Currently Working On: sets the real
   task to Completed (school task or General Task), so its school page shows
   it too. Only someone signed on the task can complete it here. */
export async function completeWorkItem(formData: FormData): Promise<PlanActionResult> {
  const target = parseNoteKey(String(formData.get("itemKey") || ""));
  if (!target || (target.type !== "task" && target.type !== "general")) return { error: "That item can't be completed from here." };

  if (await isDemoMode()) {
    let outcome: PlanActionResult = { error: null };
    await demoMutate((state) => {
      if (target.type === "general") {
        const task = (state.generalTasks || []).find((t) => t.id === target.id);
        if (!task || !task.vaAssigned.includes("Jane")) { outcome = { error: "You can only complete a task you're signed on to." }; return; }
        task.status = "Completed";
        return;
      }
      for (const sd of Object.values(state.schoolData)) {
        const task = sd.tasks?.find((t) => t.id === target.id);
        if (!task) continue;
        if (!task.vaAssigned.includes("Jane")) { outcome = { error: "You can only complete a task you're signed on to." }; return; }
        task.status = "Completed";
        const assignment = sd.taskFiles?.flatMap((f) => f.categories).find((a) => a.id === target.id);
        if (assignment) assignment.status = "Completed";
        return;
      }
    });
    revalidatePath("/overview");
    return outcome;
  }

  return runPlanAction(async () => {
    const { supabase, me } = await requireTeamMember();

    if (target.type === "general") {
      const { data: task, error } = await supabase.from("general_tasks").select("va_assigned").eq("id", target.id).maybeSingle();
      orThrow(error);
      if (!task || !(task.va_assigned || []).includes(me.name)) throw new Error("You can only complete a task you're signed on to.");
      const { error: updateError } = await supabase.from("general_tasks").update({ status: "Completed" }).eq("id", target.id);
      orThrow(updateError);
      revalidatePath("/overview");
      revalidatePath("/general-tasks");
      return;
    }

    const { data: assignment, error } = await supabase.from("task_file_categories").select("id, va_assigned, task_file_id").eq("id", target.id).maybeSingle();
    orThrow(error);
    if (!assignment || !(assignment.va_assigned || []).includes(me.name)) throw new Error("You can only complete a task you're signed on to.");
    const { data: file, error: fileError } = await supabase.from("task_files").select("school_id").eq("id", assignment.task_file_id).maybeSingle();
    orThrow(fileError);
    if (!file) throw new Error("Couldn't find that task's school.");
    const { error: rpcError } = await supabase.rpc("update_task_assignment", { p_school_id: file.school_id, p_task_id: assignment.id, p_patch: { status: "Completed" } });
    orThrow(rpcError);
    revalidatePath("/overview");
    revalidatePath(`/schools/${file.school_id}`);
  });
}

export async function saveWorkNote(formData: FormData): Promise<PlanActionResult> {
  const itemKey = String(formData.get("itemKey") || "");
  const note = String(formData.get("note") || "").replace(/\s+/g, " ").trim();
  const target = parseNoteKey(itemKey);
  if (!target) return { error: "That item can't take a note." };
  if (note.length > MAX_WORK_NOTE) return { error: `Notes can be up to ${MAX_WORK_NOTE} characters.` };

  if (await isDemoMode()) {
    let outcome: PlanActionResult = { error: null };
    await demoMutate((state) => {
      const me = "Jane";
      const mine =
        target.type === "task"
          ? Object.values(state.schoolData).some((school) => (school.tasks || []).some((t) => t.id === target.id && t.vaAssigned.includes(me)))
          : target.type === "general"
            ? (state.generalTasks || []).some((t) => t.id === target.id && t.vaAssigned.includes(me))
            : (state.planItems || []).some((p) => p.id === target.id && p.vaName === me);
      if (!mine) {
        outcome = { error: "You can only add notes to your own work." };
        return;
      }
      const others = (state.workNotes || []).filter((n) => !(n.itemKey === itemKey && n.vaName === me));
      state.workNotes = note ? [...others, { itemKey, vaName: me, note, updatedAt: new Date().toISOString() }] : others;
    });
    if (!outcome.error) revalidatePath("/", "layout");
    return outcome;
  }

  try {
    const { supabase, me } = await requireTeamMember();

    let mine = false;
    if (target.type === "task") {
      const { data } = await supabase.from("task_file_categories").select("va_assigned").eq("id", target.id).maybeSingle();
      mine = !!data && (data.va_assigned || []).includes(me.name);
    } else if (target.type === "general") {
      const { data } = await supabase.from("general_tasks").select("va_assigned").eq("id", target.id).maybeSingle();
      mine = !!data && (data.va_assigned || []).includes(me.name);
    } else {
      const { data } = await supabase.from("plan_items").select("va_name").eq("id", target.id).maybeSingle();
      mine = !!data && data.va_name === me.name;
    }
    if (!mine) return { error: "You can only add notes to your own work." };

    if (!note) {
      const { error } = await supabase.from("work_notes").delete().eq("item_key", itemKey).eq("va_name", me.name);
      orThrow(error);
    } else {
      const { error } = await supabase
        .from("work_notes")
        .upsert({ item_key: itemKey, va_name: me.name, note, updated_at: new Date().toISOString() }, { onConflict: "item_key,va_name" });
      orThrow(error);
    }
    revalidatePath("/", "layout");
    return { error: null };
  } catch (error) {
    console.error("Saving a work note failed", error);
    return { error: "Couldn't save that note. Try again." };
  }
}
