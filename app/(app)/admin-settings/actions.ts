"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode } from "@/lib/demo-session";
import { runAutomaticBackup, missingBackupEnv } from "@/lib/automatic-backup";
import { BACKUP_BUCKET, isBackupFileName } from "@/lib/backup-schedule";
import {
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
  type EodReport,
  type Issue,
  type AccessRequest,
  type DistributionGroup,
  type DistributionRow,
} from "@/lib/app-state";

/* Was requireAdminAndState(): fetchAppState() -- the whole app's ~39-table
   Promise.all -- just to check isAdmin(), same pattern already found and
   fixed in app/(app)/team/actions.ts's own requireAdmin() (see its comment).
   None of this file's actions ever read the state that call used to return
   (confirmed directly: a grep for `state.` in this file turns up nothing
   outside the backup-file shape checks below, which validate an UPLOADED
   file's contents, not this). requireTeamMember() also gives every action
   here the same friendly demo-mode message every other Server Action in the
   app already shows, instead of "Not signed in" -- restoreBackup and
   resetAllTasks used to skip that entirely and hit auth.getUser() with no
   real session in demo mode. */
async function requireAdmin() {
  const { supabase, me } = await requireTeamMember();
  if (!isAdmin(me)) throw new Error("Not authorized");
  return { supabase, me };
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

function isValidIssueRow(i: unknown): i is Issue {
  return (
    !!i &&
    typeof i === "object" &&
    typeof (i as Issue).id === "string" &&
    (i as Issue).id.length > 0 &&
    typeof (i as Issue).type === "string" &&
    typeof (i as Issue).reportedBy === "string" &&
    typeof (i as Issue).status === "string"
  );
}

function isValidAccessRequestRow(r: unknown): r is AccessRequest {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as AccessRequest).id === "string" &&
    (r as AccessRequest).id.length > 0 &&
    typeof (r as AccessRequest).recordKind === "string" &&
    typeof (r as AccessRequest).targetId === "string" &&
    typeof (r as AccessRequest).requestedBy === "string" &&
    typeof (r as AccessRequest).status === "string" &&
    // label/reason are NOT NULL with no default in access_requests --
    // an unvalidated malformed row here would pass validation, empty
    // the table on delete, then fail the insert with a NOT NULL
    // violation, leaving it permanently empty with nothing to restore.
    typeof (r as AccessRequest).label === "string" &&
    typeof (r as AccessRequest).reason === "string"
  );
}

function isValidDistributionRowShape(r: unknown): r is DistributionRow {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as DistributionRow).id === "string" &&
    (r as DistributionRow).id.length > 0 &&
    typeof (r as DistributionRow).school === "string"
  );
}

function isValidDistributionGroupRow(g: unknown): g is DistributionGroup {
  return (
    !!g &&
    typeof g === "object" &&
    typeof (g as DistributionGroup).id === "string" &&
    (g as DistributionGroup).id.length > 0 &&
    typeof (g as DistributionGroup).name === "string" &&
    Array.isArray((g as DistributionGroup).rows) &&
    (g as DistributionGroup).rows.every(isValidDistributionRowShape)
  );
}

function isValidEodReportRow(r: unknown): r is EodReport {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as EodReport).id === "string" &&
    (r as EodReport).id.length > 0 &&
    typeof (r as EodReport).author === "string" &&
    typeof (r as EodReport).date === "string" &&
    (r as EodReport).date.length > 0
  );
}

export async function restoreBackup(formData: FormData) {
  const { supabase } = await requireAdmin();
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
  await performRestore(supabase, parsed);
}

/* The restore itself, shared by the "restore from a file" form above and
   the Restore button beside each automatic backup. Returns false (having
   changed nothing) if the file doesn't pass the up-front sanity checks. */
async function performRestore(supabase: Awaited<ReturnType<typeof createClient>>, parsed: unknown): Promise<boolean> {
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
    ((parsed as AppState).communicationEditor !== undefined && typeof (parsed as AppState).communicationEditor !== "string") ||
    !Array.isArray((parsed as AppState).eodReports) ||
    !(parsed as AppState).eodReports!.every(isValidEodReportRow) ||
    !Array.isArray((parsed as AppState).issues) ||
    !(parsed as AppState).issues!.every(isValidIssueRow) ||
    !Array.isArray((parsed as AppState).accessRequests) ||
    !(parsed as AppState).accessRequests!.every(isValidAccessRequestRow) ||
    !Array.isArray((parsed as AppState).distributionGroups) ||
    !(parsed as AppState).distributionGroups!.every(isValidDistributionGroupRow)
  ) {
    return false;
  }

  const backup = parsed as AppState;

  // Restore related school/task/checklist records together, or roll back all of them.
  const { error: restoreError } = await supabase.rpc("restore_school_task_backup", { p_backup: backup });
  orThrow(restoreError);

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

  /* An automatic nightly backup deliberately leaves private notes out
     (see lib/automatic-backup.ts), so restoring one must NOT clear the
     private notes people have now -- only a manual backup, which does
     carry them, replaces them. */
  const keepPrivateNotes = !!backup.backupMeta?.excludes?.includes("privateNotes");
  if (!keepPrivateNotes) {
    const { error: delPrivateError } = await supabase.from("private_notes").delete().neq("id", "");
    orThrow(delPrivateError);
  }
  if (!keepPrivateNotes && backup.privateNotes!.length) {
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

  const { error: delEodError } = await supabase.from("eod_reports").delete().neq("id", "");
  orThrow(delEodError);
  if (backup.eodReports!.length) {
    const eodRows = backup.eodReports!.map((r) => ({
      id: r.id,
      author: r.author,
      date: r.date,
      time_in: r.timeIn || null,
      break_start: r.breakStart || null,
      break_end: r.breakEnd || null,
      time_out: r.timeOut || null,
      total_hours: r.totalHours || null,
      tasks: r.tasks || [],
      // Preserve the report's real historical timestamp -- omitting
      // this would let the eod_reports.created_at default (now()) take
      // over, stamping every restored report with the moment of the
      // restore instead of when it was actually submitted, and
      // corrupting the chronological order fetchAppState() relies on.
      created_at: r.createdAt,
    }));
    const { error: insEodError } = await supabase.from("eod_reports").insert(eodRows);
    orThrow(insEodError);
  }

  const { error: delIssuesError } = await supabase.from("issues").delete().neq("id", "");
  orThrow(delIssuesError);
  if (backup.issues!.length) {
    const issueRows = backup.issues!.map((i) => ({
      id: i.id,
      type: i.type,
      reported_by: i.reportedBy,
      status: i.status,
      created_at: i.createdAt,
      description: i.description || null,
      category: i.category || null,
      remarks: i.remarks || null,
      student_name: i.studentName || null,
      dob: i.dob || null,
      insurance_number: i.insuranceNumber || null,
      school_year: i.schoolYear || null,
      file_name: i.fileName || null,
      page_number: i.pageNumber || null,
      correcting_category: i.correctingCategory || null,
      correct_info: i.correctInfo || null,
      correction_kind: i.correctionKind || null,
      student_record_link: i.studentRecordLink || null,
      needs_name_correction: i.needsNameCorrection ?? null,
      needs_dob_correction: i.needsDobCorrection ?? null,
      needs_insurance_correction: i.needsInsuranceCorrection ?? null,
      needs_other_correction: i.needsOtherCorrection ?? null,
      other_correction_detail: i.otherCorrectionDetail || null,
      question: i.question || null,
      fixed_by: i.fixedBy || [],
    }));
    const { error: insIssuesError } = await supabase.from("issues").insert(issueRows);
    orThrow(insIssuesError);
  }

  const { error: delAccessError } = await supabase.from("access_requests").delete().neq("id", "");
  orThrow(delAccessError);
  if (backup.accessRequests!.length) {
    const accessRows = backup.accessRequests!.map((r) => ({
      id: r.id,
      record_kind: r.recordKind,
      school_id: r.schoolId || null,
      target_id: r.targetId,
      label: r.label,
      reason: r.reason,
      requested_by: r.requestedBy,
      status: r.status,
      resolved_by: r.resolvedBy || null,
      resolved_at: r.resolvedAt || null,
      created_at: r.createdAt,
    }));
    const { error: insAccessError } = await supabase.from("access_requests").insert(accessRows);
    orThrow(insAccessError);
  }

  /* Deleting distribution_groups cascades to distribution_rows
     automatically (group_id references distribution_groups(id) on
     delete cascade) -- no separate distribution_rows delete needed. */
  const { error: delDistGroupsError } = await supabase.from("distribution_groups").delete().neq("id", "");
  orThrow(delDistGroupsError);
  if (backup.distributionGroups!.length) {
    const distGroupRows = backup.distributionGroups!.map((g, index) => ({
      id: g.id,
      name: g.name,
      sort_order: index,
    }));
    const { error: insDistGroupsError } = await supabase.from("distribution_groups").insert(distGroupRows);
    orThrow(insDistGroupsError);

    const distRowRows = backup.distributionGroups!.flatMap((g) =>
      g.rows.map((r, rowIndex) => ({
        id: r.id,
        group_id: g.id,
        school: r.school,
        enrolled: r.enrolled || null,
        contact_person: r.contactPerson || null,
        remarks: r.remarks || null,
        breakdown: r.breakdown || {},
        sort_order: rowIndex,
      }))
    );
    if (distRowRows.length) {
      const { error: insDistRowsError } = await supabase.from("distribution_rows").insert(distRowRows);
      orThrow(insDistRowsError);
    }
  }

  await saveState(supabase, backup);
  revalidatePath("/", "layout");
  return true;
}

export async function resetAllTasks(formData: FormData) {
  const { supabase } = await requireAdmin();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESET") return;

  const { error } = await supabase.rpc("reset_school_task_data");
  orThrow(error);

  revalidatePath("/", "layout");
}

/* --- Automatic backups (see lib/automatic-backup.ts) --------------------
   Both actions return plain data instead of throwing, so the page can show
   a real reason (a thrown error is redacted in production). */

/* Runs the same backup the nightly job runs, right now. Admin only. */
export async function backUpNow(): Promise<{ error: string | null }> {
  if (await isDemoMode()) return { error: "Automatic backups aren't available in the demo." };
  try {
    await requireAdmin();
  } catch {
    return { error: "Only admins can run a backup." };
  }
  const missing = missingBackupEnv();
  if (missing.includes("SUPABASE_SERVICE_ROLE_KEY")) return { error: "The backup isn't set up yet -- see the setup steps on this page." };
  const result = await runAutomaticBackup();
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin-settings");
  return { error: null };
}

/* A short-lived link that saves one automatic backup to the admin's
   device. Read under the admin's own session, so the storage policy (admins
   only) is what decides. */
export async function getBackupDownloadUrl(name: string): Promise<{ url: string | null; error: string | null }> {
  if (await isDemoMode()) return { url: null, error: "Downloads aren't available in the demo." };
  if (!isBackupFileName(name)) return { url: null, error: "That isn't a backup file." };
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(name, 120, { download: `csdp-tracker-backup-${name}` });
    if (error || !data) return { url: null, error: "Couldn't prepare that download." };
    return { url: data.signedUrl, error: null };
  } catch {
    return { url: null, error: "Only admins can download backups." };
  }
}

/* The Restore button beside an automatic backup. Admin only, and it must be
   confirmed by typing RESTORE (same as the file form).

   Restoring replaces everything with the backup, so BEFORE touching
   anything it saves a "before restore" safety copy of how things are right
   now -- if that can't be saved, nothing is restored. That copy shows in
   the list and can itself be restored, which is the undo. Private notes are
   left alone (automatic backups don't contain them; see
   lib/automatic-backup.ts). The restore isn't one single all-or-nothing
   step, so if it stops partway the message says so and points at the
   safety copy. */
export async function restoreFromAutomaticBackup(name: string, confirm: string): Promise<{ error: string | null }> {
  if (await isDemoMode()) return { error: "Restoring isn't available in the demo." };
  if (confirm !== "RESTORE") return { error: "Type RESTORE to confirm." };
  if (!isBackupFileName(name)) return { error: "That isn't a backup file." };

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch {
    return { error: "Only admins can restore a backup." };
  }

  const safety = await runAutomaticBackup({ safety: true });
  if (!safety.ok) return { error: `Nothing was restored: a safety copy of the current data couldn't be saved first. (${safety.error})` };

  const { data: blob, error: downloadError } = await supabase.storage.from(BACKUP_BUCKET).download(name);
  if (downloadError || !blob) return { error: "Nothing was restored: that backup file couldn't be read." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await blob.text());
  } catch {
    return { error: "Nothing was restored: that backup file is damaged." };
  }

  try {
    const restored = await performRestore(supabase, parsed);
    if (!restored) return { error: "Nothing was restored: that backup file didn't pass the safety checks." };
  } catch {
    return { error: `The restore stopped partway. A safety copy of how things were was saved (${safety.name}) -- restore that one to undo, then try again.` };
  }
  revalidatePath("/", "layout");
  return { error: null };
}
