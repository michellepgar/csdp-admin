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
  type Task,
  type EmailTrackerItem,
  type Suggestion,
  type GeneralNote,
  type PrivateNote,
  type EmailTemplate,
  type ContactGroup,
  type ContactRow,
  type NurseLeader,
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

function isValidTaskRow(t: unknown): t is Task {
  return (
    !!t &&
    typeof t === "object" &&
    typeof (t as Task).id === "string" &&
    (t as Task).id.length > 0 &&
    typeof (t as Task).category === "string" &&
    typeof (t as Task).fileName === "string" &&
    (t as Task).fileName.length > 0 &&
    typeof (t as Task).status === "string" &&
    Array.isArray((t as Task).vaAssigned)
  );
}

function isValidEmailTrackerRow(e: unknown): e is EmailTrackerItem {
  return (
    !!e &&
    typeof e === "object" &&
    typeof (e as EmailTrackerItem).id === "string" &&
    (e as EmailTrackerItem).id.length > 0 &&
    typeof (e as EmailTrackerItem).description === "string" &&
    typeof (e as EmailTrackerItem).status === "string" &&
    typeof (e as EmailTrackerItem).addedBy === "string"
  );
}

function isValidSuggestionRow(s: unknown): s is Suggestion {
  return (
    !!s &&
    typeof s === "object" &&
    typeof (s as Suggestion).id === "string" &&
    (s as Suggestion).id.length > 0 &&
    typeof (s as Suggestion).text === "string" &&
    typeof (s as Suggestion).author === "string" &&
    typeof (s as Suggestion).status === "string"
  );
}

function isValidGeneralNoteRow(n: unknown): n is GeneralNote {
  return (
    !!n &&
    typeof n === "object" &&
    typeof (n as GeneralNote).id === "string" &&
    (n as GeneralNote).id.length > 0 &&
    typeof (n as GeneralNote).text === "string" &&
    typeof (n as GeneralNote).author === "string"
  );
}

function isValidPrivateNoteRow(n: unknown): n is PrivateNote {
  return (
    !!n &&
    typeof n === "object" &&
    typeof (n as PrivateNote).id === "string" &&
    (n as PrivateNote).id.length > 0 &&
    typeof (n as PrivateNote).text === "string" &&
    typeof (n as PrivateNote).author === "string"
  );
}

function isValidEmailTemplateRow(t: unknown): t is EmailTemplate {
  return (
    !!t &&
    typeof t === "object" &&
    typeof (t as EmailTemplate).id === "string" &&
    (t as EmailTemplate).id.length > 0 &&
    typeof (t as EmailTemplate).name === "string" &&
    typeof (t as EmailTemplate).subject === "string" &&
    typeof (t as EmailTemplate).body === "string"
  );
}

function isValidContactRowShape(r: unknown): r is ContactRow {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as ContactRow).id === "string" &&
    (r as ContactRow).id.length > 0 &&
    typeof (r as ContactRow).school === "string"
  );
}

function isValidContactGroupRow(g: unknown): g is ContactGroup {
  return (
    !!g &&
    typeof g === "object" &&
    typeof (g as ContactGroup).id === "string" &&
    (g as ContactGroup).id.length > 0 &&
    typeof (g as ContactGroup).name === "string" &&
    Array.isArray((g as ContactGroup).rows) &&
    (g as ContactGroup).rows.every(isValidContactRowShape)
  );
}

function isValidNurseLeader(n: unknown): n is NurseLeader {
  return (
    !!n &&
    typeof n === "object" &&
    typeof (n as NurseLeader).name === "string" &&
    typeof (n as NurseLeader).email === "string"
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
     happened for real during Phase 1's rollout). The same "reject
     upfront, not partway through" principle also covers schoolData and
     checklistProgress: both are non-optional fields on AppState, so
     they must be present and be plain objects, and every task/email
     item nested inside schoolData must have the right shape --
     otherwise a corrupted file could sail through validation and wipe
     tasks/email_tracker_items/checklist_progress with nothing to
     restore, or make an insert fail with a NOT NULL violation after
     the delete already ran. schoolData's tasks/emailTracker arrays and
     checklistProgress are allowed to be empty -- a school legitimately
     having zero tasks is normal, unlike vas or schools ever
     legitimately being empty. Only presence and row shape are checked
     here, not non-emptiness. */
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
    !(parsed as AppState).checklistTemplate.every(isValidChecklistTemplateRow) ||
    typeof (parsed as AppState).schoolData !== "object" ||
    (parsed as AppState).schoolData === null ||
    typeof (parsed as AppState).checklistProgress !== "object" ||
    (parsed as AppState).checklistProgress === null ||
    !Object.values((parsed as AppState).schoolData || {}).every(
      (sd) =>
        !!sd &&
        typeof sd === "object" &&
        (sd.tasks || []).every(isValidTaskRow) &&
        (sd.emailTracker || []).every(isValidEmailTrackerRow)
    ) ||
    !Array.isArray((parsed as AppState).suggestions) ||
    !(parsed as AppState).suggestions!.every(isValidSuggestionRow) ||
    !Array.isArray((parsed as AppState).generalNotes) ||
    !(parsed as AppState).generalNotes!.every(isValidGeneralNoteRow) ||
    !Array.isArray((parsed as AppState).privateNotes) ||
    !(parsed as AppState).privateNotes!.every(isValidPrivateNoteRow) ||
    !Array.isArray((parsed as AppState).emailTemplates) ||
    !(parsed as AppState).emailTemplates!.every(isValidEmailTemplateRow) ||
    !Array.isArray((parsed as AppState).contactGroups) ||
    !(parsed as AppState).contactGroups!.every(isValidContactGroupRow) ||
    ((parsed as AppState).nurseLeader !== undefined && !isValidNurseLeader((parsed as AppState).nurseLeader)) ||
    ((parsed as AppState).communicationEditor !== undefined && typeof (parsed as AppState).communicationEditor !== "string")
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
  const catRows = backup.taskCategories!.map((c, index) => ({ id: c.id, name: c.name, sort_order: index }));
  const { error: insCatError } = await supabase.from("task_categories").insert(catRows);
  orThrow(insCatError);

  const { error: delTemplateError } = await supabase.from("checklist_template").delete().neq("id", "");
  orThrow(delTemplateError);
  const templateRows = backup.checklistTemplate.map((t, index) => ({ id: t.id, description: t.description, sort_order: index }));
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

  const { error: delSuggestionsError } = await supabase.from("suggestions").delete().neq("id", "");
  orThrow(delSuggestionsError);
  if (backup.suggestions!.length) {
    const suggestionRows = backup.suggestions!.map((s) => ({
      id: s.id,
      text: s.text,
      author: s.author,
      status: s.status,
    }));
    const { error: insSuggestionsError } = await supabase.from("suggestions").insert(suggestionRows);
    orThrow(insSuggestionsError);
  }

  const { error: delNotesError } = await supabase.from("general_notes").delete().neq("id", "");
  orThrow(delNotesError);
  if (backup.generalNotes!.length) {
    const noteRows = backup.generalNotes!.map((n) => ({
      id: n.id,
      text: n.text,
      author: n.author,
      urgency: n.urgency || null,
      ack_by: n.ackBy || [],
    }));
    const { error: insNotesError } = await supabase.from("general_notes").insert(noteRows);
    orThrow(insNotesError);
  }

  const { error: delPrivateError } = await supabase.from("private_notes").delete().neq("id", "");
  orThrow(delPrivateError);
  if (backup.privateNotes!.length) {
    const privateRows = backup.privateNotes!.map((n) => ({
      id: n.id,
      text: n.text,
      author: n.author,
      shared_with: n.sharedWith || [],
      ack_by: n.ackBy || [],
    }));
    const { error: insPrivateError } = await supabase.from("private_notes").insert(privateRows);
    orThrow(insPrivateError);
  }

  const { error: delTemplatesError } = await supabase.from("email_templates").delete().neq("id", "");
  orThrow(delTemplatesError);
  if (backup.emailTemplates!.length) {
    const templateRows = backup.emailTemplates!.map((t, index) => ({
      id: t.id,
      name: t.name,
      category: t.category || null,
      subject: t.subject,
      body: t.body,
      sort_order: index,
    }));
    const { error: insTemplatesError } = await supabase.from("email_templates").insert(templateRows);
    orThrow(insTemplatesError);
  }

  /* Deleting contact_groups cascades to contact_rows automatically
     (group_id references contact_groups(id) on delete cascade) -- no
     separate contact_rows delete needed. */
  const { error: delGroupsError } = await supabase.from("contact_groups").delete().neq("id", "");
  orThrow(delGroupsError);
  if (backup.contactGroups!.length) {
    const groupRows = backup.contactGroups!.map((g, index) => ({ id: g.id, name: g.name, sort_order: index }));
    const { error: insGroupsError } = await supabase.from("contact_groups").insert(groupRows);
    orThrow(insGroupsError);

    const allContactRows = backup.contactGroups!.flatMap((g) =>
      g.rows.map((r) => ({ groupId: g.id, row: r }))
    );
    const contactRowRows = allContactRows.map((entry, index) => ({
      id: entry.row.id,
      group_id: entry.groupId,
      school: entry.row.school,
      principal: entry.row.principal || null,
      principal_email: entry.row.principalEmail || null,
      asst_principal: entry.row.asstPrincipal || null,
      asst_principal_email: entry.row.asstPrincipalEmail || null,
      front_desk: entry.row.frontDesk || null,
      front_desk_email: entry.row.frontDeskEmail || null,
      nurse_name: entry.row.nurseName || null,
      nurse_email: entry.row.nurseEmail || null,
      notes: entry.row.notes || null,
      sort_order: index,
    }));
    if (contactRowRows.length) {
      const { error: insRowsError } = await supabase.from("contact_rows").insert(contactRowRows);
      orThrow(insRowsError);
    }
  }

  if (backup.nurseLeader) {
    const { error: nurseLeaderError } = await supabase
      .from("settings")
      .upsert({ key: "nurseLeader", value: backup.nurseLeader }, { onConflict: "key" });
    orThrow(nurseLeaderError);
  }
  if (backup.communicationEditor !== undefined) {
    const { error: commEditorError } = await supabase
      .from("settings")
      .upsert({ key: "communicationEditor", value: { value: backup.communicationEditor } }, { onConflict: "key" });
    orThrow(commEditorError);
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
