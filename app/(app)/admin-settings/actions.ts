"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  isAdmin,
  type AppState,
  type Va,
  type School,
  type TaskCategory,
  type ChecklistTemplateItem,
} from "@/lib/app-state";

async function requireAdminAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) throw new Error("Not authorized");

  return { supabase, state };
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

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isValidVaRow(v: unknown): v is Va {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Va).id === "string" &&
    (v as Va).id.length > 0 &&
    typeof (v as Va).name === "string" &&
    (v as Va).name.length > 0
  );
}

function isValidSchoolRow(s: unknown): s is School {
  return (
    !!s &&
    typeof s === "object" &&
    typeof (s as School).id === "string" &&
    (s as School).id.length > 0 &&
    typeof (s as School).name === "string" &&
    (s as School).name.length > 0
  );
}

function isValidTaskCategoryRow(c: unknown): c is TaskCategory {
  return (
    !!c &&
    typeof c === "object" &&
    typeof (c as TaskCategory).id === "string" &&
    (c as TaskCategory).id.length > 0 &&
    typeof (c as TaskCategory).name === "string" &&
    (c as TaskCategory).name.length > 0
  );
}

function isValidChecklistTemplateRow(t: unknown): t is ChecklistTemplateItem {
  return (
    !!t &&
    typeof t === "object" &&
    typeof (t as ChecklistTemplateItem).id === "string" &&
    (t as ChecklistTemplateItem).id.length > 0 &&
    typeof (t as ChecklistTemplateItem).description === "string" &&
    (t as ChecklistTemplateItem).description.length > 0
  );
}

export async function restoreBackup(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESTORE") return;

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return;
  }
  /* Sanity check before touching anything: a real backup always has
     non-empty vas/schools/taskCategories/checklistTemplate arrays, and
     every row in them must at least look like the real thing -- vas
     and schools now live in their own tables (Phase 1), and task
     categories/checklist template now do too (Phase 2), so a malformed
     file must be rejected upfront rather than partway through, or it
     can leave a table wiped with nothing valid to put back (this
     happened for real during Phase 1's rollout). schoolData's
     tasks/emailTracker and checklistProgress are allowed to be empty
     -- a school legitimately having zero tasks is normal, unlike vas
     or schools ever legitimately being empty. */
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as AppState).vas) ||
    (parsed as AppState).vas.length === 0 ||
    !(parsed as AppState).vas.every(isValidVaRow) ||
    !Array.isArray((parsed as AppState).schools) ||
    (parsed as AppState).schools.length === 0 ||
    !(parsed as AppState).schools.every(isValidSchoolRow) ||
    !Array.isArray((parsed as AppState).taskCategories) ||
    (parsed as AppState).taskCategories!.length === 0 ||
    !(parsed as AppState).taskCategories!.every(isValidTaskCategoryRow) ||
    !Array.isArray((parsed as AppState).checklistTemplate) ||
    (parsed as AppState).checklistTemplate.length === 0 ||
    !(parsed as AppState).checklistTemplate.every(isValidChecklistTemplateRow)
  ) {
    return;
  }

  const backup = parsed as AppState;

  /* vas and schools now live in their own tables (Phase 1) -- see
     restore_vas_and_schools() in supabase/phase1_relational_team_schools.sql
     for why this has to go through a security definer function rather
     than a plain delete-then-insert. */
  const vasRows = backup.vas.map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    admin: v.admin,
    role: v.role,
    color: v.color,
  }));
  const schoolRows = backup.schools.map((s) => ({ id: s.id, name: s.name }));
  const { error: restoreError } = await supabase.rpc("restore_vas_and_schools", {
    new_vas: vasRows,
    new_schools: schoolRows,
  });
  orThrow(restoreError);

  /* Task categories, checklist template/progress, tasks, and email
     tracker items now live in their own tables too (Phase 2). None of
     these gate a security policy the way vas does, so plain
     delete-then-insert is safe -- no security definer function needed. */
  const { error: delCatError } = await supabase.from("task_categories").delete().neq("id", "");
  orThrow(delCatError);
  const catRows = backup.taskCategories!.map((c) => ({ id: c.id, name: c.name }));
  const { error: insCatError } = await supabase.from("task_categories").insert(catRows);
  orThrow(insCatError);

  const { error: delTemplateError } = await supabase.from("checklist_template").delete().neq("id", "");
  orThrow(delTemplateError);
  const templateRows = backup.checklistTemplate.map((t) => ({ id: t.id, description: t.description }));
  const { error: insTemplateError } = await supabase.from("checklist_template").insert(templateRows);
  orThrow(insTemplateError);

  const { error: delProgressError } = await supabase.from("checklist_progress").delete().neq("school_id", "");
  orThrow(delProgressError);
  const progressRows = Object.entries(backup.checklistProgress || {}).map(([key, entry]) => {
    const [schoolId, templateItemId] = key.split(":");
    return { school_id: schoolId, template_item_id: templateItemId, status: entry.status };
  });
  if (progressRows.length) {
    const { error: insProgressError } = await supabase.from("checklist_progress").insert(progressRows);
    orThrow(insProgressError);
  }

  const { error: delTasksError } = await supabase.from("tasks").delete().neq("id", "");
  orThrow(delTasksError);
  const taskRows = Object.entries(backup.schoolData || {}).flatMap(([schoolId, sd]) =>
    (sd.tasks || []).map((t) => ({
      id: t.id,
      school_id: schoolId,
      category: t.category,
      file_name: t.fileName,
      count: t.count,
      status: t.status,
      va_assigned: t.vaAssigned,
    }))
  );
  if (taskRows.length) {
    const { error: insTasksError } = await supabase.from("tasks").insert(taskRows);
    orThrow(insTasksError);
  }

  const { error: delEmailError } = await supabase.from("email_tracker_items").delete().neq("id", "");
  orThrow(delEmailError);
  const emailRows = Object.entries(backup.schoolData || {}).flatMap(([schoolId, sd]) =>
    (sd.emailTracker || []).map((e) => ({
      id: e.id,
      school_id: schoolId,
      description: e.description,
      status: e.status,
      added_by: e.addedBy,
    }))
  );
  if (emailRows.length) {
    const { error: insEmailError } = await supabase.from("email_tracker_items").insert(emailRows);
    orThrow(insEmailError);
  }

  await saveState(supabase, backup);
  revalidatePath("/", "layout");
}

export async function resetAllTasks(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESET") return;

  /* Tasks/Checklist Progress now live in their own tables (Phase 2 of
     the relational backend migration) -- this used to just clear
     sd.tasks/checklistProgress on the in-memory blob object. Neither
     of these deletes empties a table that gates a security policy
     (unlike vas in Phase 1's restore), so plain client calls are safe
     here -- no security definer function needed. The explicit filter
     on each delete is still required: every Supabase project blocks a
     bare DELETE with no WHERE at all. */
  const { error: delTasksError } = await supabase.from("tasks").delete().neq("id", "");
  orThrow(delTasksError);
  const { error: delProgressError } = await supabase.from("checklist_progress").delete().neq("school_id", "");
  orThrow(delProgressError);

  revalidatePath("/", "layout");
}
