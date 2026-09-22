import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDemoState } from "@/lib/demo-session";
import { groupTaskFileRows } from "@/lib/app-state";
import type { SuggestionAttachment,
  AppState,
  Va,
  School,
  SchoolContact,
  TaskFileCategory,
  EmailTrackerItem,
  ChecklistTemplateItem,
  TaskCategory,
  Suggestion,
  GeneralNote,
  PrivateNote,
  EmailTemplate,
  ContactGroup,
  ContactRow,
  OtherContact,
  DistributionRow,
  DistributionCell,
  DistributionGroup,
  NurseLeader,
  EodReport,
  Issue,
  IssueCategory,
  Comment,
  AccessRequest,
  GeneralTask,
  GeneralTaskCategory,
  PlanItem,
  Mention,
} from "@/lib/app-state";

type SchoolRow = {
  id: string;
  name: string;
  website: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  hours: string | null;
  email_notes: string | null;
};

function mapSchoolRow(r: SchoolRow): School {
  return {
    id: r.id,
    name: r.name,
    website: r.website ?? undefined,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    fax: r.fax ?? undefined,
    hours: r.hours ?? undefined,
    emailNotes: r.email_notes ?? undefined,
  };
}

type VaRow = {
  id: string;
  name: string;
  email: string | null;
  admin: boolean | null;
  communication_access: boolean | null;
  role: string | null;
  color: string | null;
};

function mapVaRow(r: VaRow): Va {
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    admin: r.admin ?? undefined,
    communicationAccess: r.communication_access ?? undefined,
    role: r.role ?? undefined,
    color: r.color ?? undefined,
  };
}

type TaskFileRow = {
  id: string;
  table_id: string | null;
  school_id: string;
  file_name: string;
  sort_order: number;
  created_at: string;
};

type TaskFileCategoryRow = {
  id: string;
  created_at: string;
  task_file_id: string;
  category_id: string;
  status: string;
  va_assigned: string[];
  sort_order: number;
  count: string | number | null;
  comms_status: string | null;
  comms_va_assigned: string[] | null;
};

type EmailTrackerRow = {
  id: string;
  school_id: string;
  description: string;
  status: string;
  added_by: string;
  created_at: string;
};

function mapEmailTrackerRow(r: EmailTrackerRow): EmailTrackerItem {
  return {
    id: r.id,
    description: r.description,
    status: r.status,
    addedBy: r.added_by,
    createdAt: r.created_at,
  };
}

type SuggestionRow = {
  id: string;
  text: string;
  author: string;
  status: string;
  created_at: string;
};

function mapSuggestionRow(r: SuggestionRow): Suggestion {
  return {
    id: r.id,
    text: r.text,
    author: r.author,
    status: r.status as Suggestion["status"],
    createdAt: r.created_at,
  };
}

type GeneralNoteRow = {
  id: string;
  text: string;
  author: string;
  urgency: string | null;
  ack_by: string[];
  comment_ack_by: string[];
  created_at: string;
  pad_color: string | null;
};

function mapGeneralNoteRow(r: GeneralNoteRow): GeneralNote {
  return {
    id: r.id,
    text: r.text,
    padColor: r.pad_color ?? undefined,
    author: r.author,
    urgency: (r.urgency as "Urgent" | "" | null) ?? undefined,
    ackBy: r.ack_by,
    commentAckBy: r.comment_ack_by,
    createdAt: r.created_at,
  };
}

type PrivateNoteRow = {
  id: string;
  text: string;
  author: string;
  shared_with: string[];
  ack_by: string[];
  comment_ack_by: string[];
  created_at: string;
  pad_color: string | null;
  board_x: number | null;
  board_y: number | null;
  board_rotation: number | null;
  board_width: number | null;
  board_height: number | null;
  board_z: number | null;
  is_reminder: boolean | null;
};

function mapPrivateNoteRow(r: PrivateNoteRow): PrivateNote {
  return {
    id: r.id,
    text: r.text,
    padColor: r.pad_color ?? undefined,
    author: r.author,
    sharedWith: r.shared_with,
    ackBy: r.ack_by,
    commentAckBy: r.comment_ack_by,
    boardX: r.board_x ?? undefined,
    boardY: r.board_y ?? undefined,
    boardRotation: r.board_rotation ?? undefined,
    boardWidth: r.board_width ?? undefined,
    boardHeight: r.board_height ?? undefined,
    boardZ: r.board_z ?? undefined,
    createdAt: r.created_at,
    isReminder: r.is_reminder ?? false,
  };
}

type EmailTemplateRow = {
  id: string;
  name: string;
  category: string | null;
  subject: string;
  body: string;
};

function mapEmailTemplateRow(r: EmailTemplateRow): EmailTemplate {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? undefined,
    subject: r.subject,
    body: r.body,
  };
}

type ContactGroupRow = { id: string; name: string };

type ContactRowDbRow = {
  id: string;
  group_id: string;
  school: string;
  principal: string | null;
  principal_email: string | null;
  asst_principal: string | null;
  asst_principal_email: string | null;
  front_desk: string | null;
  front_desk_email: string | null;
  nurse_name: string | null;
  nurse_email: string | null;
  notes: string | null;
};

function mapContactRowDbRow(r: ContactRowDbRow): ContactRow {
  return {
    id: r.id,
    school: r.school,
    principal: r.principal ?? undefined,
    principalEmail: r.principal_email ?? undefined,
    asstPrincipal: r.asst_principal ?? undefined,
    asstPrincipalEmail: r.asst_principal_email ?? undefined,
    frontDesk: r.front_desk ?? undefined,
    frontDeskEmail: r.front_desk_email ?? undefined,
    nurseName: r.nurse_name ?? undefined,
    nurseEmail: r.nurse_email ?? undefined,
    notes: r.notes ?? undefined,
  };
}

type OtherContactRow = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

function mapOtherContactRow(r: OtherContactRow): OtherContact {
  return {
    id: r.id,
    name: r.name,
    organization: r.organization ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    notes: r.notes ?? undefined,
  };
}

type DistributionGroupRow = { id: string; name: string };

type DistributionRowDbRow = {
  id: string;
  group_id: string;
  school: string;
  enrolled: string | null;
  distributed: boolean | null;
  classroom_regular: string | null;
  classroom_launch: string | null;
  classroom_crr: string | null;
  consent_packets: string | null;
  contact_person: string | null;
  remarks: string | null;
  breakdown: Record<string, Record<string, DistributionCell>>;
};

function mapDistributionRowDbRow(r: DistributionRowDbRow): DistributionRow {
  return {
    id: r.id,
    school: r.school,
    enrolled: r.enrolled ?? undefined,
    distributed: r.distributed ?? false,
    classroomRegular: r.classroom_regular ?? undefined,
    classroomLaunch: r.classroom_launch ?? undefined,
    classroomCrr: r.classroom_crr ?? undefined,
    consentPackets: r.consent_packets ?? undefined,
    contactPerson: r.contact_person ?? undefined,
    remarks: r.remarks ?? undefined,
    breakdown: r.breakdown,
  };
}

type EodReportRow = {
  id: string;
  author: string;
  date: string;
  time_in: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
  total_hours: string | null;
  tasks: string[];
  created_at: string;
};

function mapEodReportRow(r: EodReportRow): EodReport {
  return {
    id: r.id,
    author: r.author,
    date: r.date,
    timeIn: r.time_in ?? undefined,
    breakStart: r.break_start ?? undefined,
    breakEnd: r.break_end ?? undefined,
    timeOut: r.time_out ?? undefined,
    totalHours: r.total_hours ?? undefined,
    tasks: r.tasks,
    createdAt: r.created_at,
  };
}

type GeneralTaskRow = {
  id: string;
  category: string;
  description: string;
  status: string;
  va_assigned: string[];
  created_at: string;
};

function mapGeneralTaskRow(r: GeneralTaskRow): GeneralTask {
  return {
    id: r.id,
    category: r.category,
    description: r.description,
    status: r.status,
    vaAssigned: r.va_assigned,
    createdAt: r.created_at,
  };
}

type PlanItemRow = {
  id: string;
  kind: "task" | "priority" | "note";
  va_name: string | null;
  school_id: string | null;
  task_file_category_id: string | null;
  general_task_id: string | null;
  label: string;
  created_by: string;
  created_at: string;
  suggested_school_id: string | null;
  suggested_category_id: string | null;
  suggested_file_name: string | null;
  note_id: string | null;
  completed_at: string | null;
  sort_order: number | null;
  assigned_to: string | null;
};

function mapPlanItemRow(r: PlanItemRow): PlanItem {
  return {
    id: r.id,
    kind: r.kind,
    vaName: r.va_name ?? undefined,
    schoolId: r.school_id ?? undefined,
    taskFileCategoryId: r.task_file_category_id ?? undefined,
    generalTaskId: r.general_task_id ?? undefined,
    label: r.label,
    createdBy: r.created_by,
    createdAt: r.created_at,
    suggestedSchoolId: r.suggested_school_id ?? undefined,
    suggestedCategoryId: r.suggested_category_id ?? undefined,
    suggestedFileName: r.suggested_file_name ?? undefined,
    noteId: r.note_id ?? undefined,
    completedAt: r.completed_at ?? undefined,
    sortOrder: r.sort_order ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
  };
}

type IssueRow = {
  id: string;
  type: string;
  reported_by: string;
  status: string;
  created_at: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  remarks: string | null;
  student_name: string | null;
  dob: string | null;
  insurance_number: string | null;
  school_year: string | null;
  file_name: string | null;
  page_number: string | null;
  correcting_category: string | null;
  correct_info: string | null;
  correction_kind: string | null;
  student_record_link: string | null;
  needs_name_correction: boolean | null;
  needs_dob_correction: boolean | null;
  needs_insurance_correction: boolean | null;
  needs_other_correction: boolean | null;
  other_correction_detail: string | null;
  question: string | null;
  fixed_by: string[];
  fix_note: string | null;
  comment_ack_by: string[] | null;
};

function mapIssueRow(r: IssueRow): Issue {
  return {
    id: r.id,
    type: r.type as Issue["type"],
    reportedBy: r.reported_by,
    status: r.status,
    createdAt: r.created_at,
    description: r.description ?? undefined,
    category: r.category ?? undefined,
    subcategory: r.subcategory ?? undefined,
    remarks: r.remarks ?? undefined,
    studentName: r.student_name ?? undefined,
    dob: r.dob ?? undefined,
    insuranceNumber: r.insurance_number ?? undefined,
    schoolYear: r.school_year ?? undefined,
    fileName: r.file_name ?? undefined,
    pageNumber: r.page_number ?? undefined,
    correctingCategory: r.correcting_category ?? undefined,
    correctInfo: r.correct_info ?? undefined,
    correctionKind: r.correction_kind ?? undefined,
    studentRecordLink: r.student_record_link ?? undefined,
    needsNameCorrection: r.needs_name_correction ?? undefined,
    needsDobCorrection: r.needs_dob_correction ?? undefined,
    needsInsuranceCorrection: r.needs_insurance_correction ?? undefined,
    needsOtherCorrection: r.needs_other_correction ?? undefined,
    otherCorrectionDetail: r.other_correction_detail ?? undefined,
    question: r.question ?? undefined,
    fixedBy: r.fixed_by,
    fixNote: r.fix_note ?? undefined,
    commentAckBy: r.comment_ack_by ?? [],
  };
}

type IssueCommentRow = { id: string; issue_id: string; author: string; text: string; created_at: string; edited_at: string | null };

function mapIssueCommentRow(r: IssueCommentRow): Comment {
  return { id: r.id, author: r.author, text: r.text, createdAt: r.created_at, editedAt: r.edited_at ?? undefined };
}

type NoteCommentRow = { id: string; note_id: string; author: string; text: string; created_at: string; edited_at: string | null };

function mapNoteCommentRow(r: NoteCommentRow): Comment {
  return { id: r.id, author: r.author, text: r.text, createdAt: r.created_at, editedAt: r.edited_at ?? undefined };
}

type MentionRow = {
  id: string;
  mentioned_name: string;
  mentioner_name: string;
  source: string;
  issue_id: string | null;
  note_id: string | null;
  snippet: string;
  created_at: string;
  read_at: string | null;
};

function mapMentionRow(r: MentionRow): Mention {
  return {
    id: r.id,
    mentionedName: r.mentioned_name,
    mentionerName: r.mentioner_name,
    source: r.source as Mention["source"],
    issueId: r.issue_id ?? undefined,
    noteId: r.note_id ?? undefined,
    snippet: r.snippet,
    createdAt: r.created_at,
    readAt: r.read_at ?? undefined,
  };
}

type SchoolContactRow = { id: string; school_id: string; position: string; name: string | null; email: string; created_at: string };

function mapSchoolContactRow(r: SchoolContactRow): SchoolContact {
  return { id: r.id, position: r.position, name: r.name ?? undefined, email: r.email, createdAt: r.created_at };
}

type AccessRequestRow = {
  id: string;
  record_kind: string;
  school_id: string | null;
  target_id: string;
  label: string;
  reason: string;
  requested_by: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

function mapAccessRequestRow(r: AccessRequestRow): AccessRequest {
  return {
    id: r.id,
    recordKind: r.record_kind as AccessRequest["recordKind"],
    schoolId: r.school_id ?? "",
    targetId: r.target_id,
    label: r.label,
    reason: r.reason,
    requestedBy: r.requested_by,
    status: r.status as AccessRequest["status"],
    resolvedBy: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}

/* Kept in its own file, separate from lib/app-state.ts's types/constants
   — this imports @/lib/supabase/server (next/headers), which is
   server-only. lib/app-state.ts is imported by client components too
   (for shared types/constants like CONTACT_FIELDS); if this function
   lived there, that server-only import would get dragged into the
   client bundle, which Next.js's build correctly refuses to do.

   Wrapped in React's cache() so the layout and the page it's rendering
   (both of which need the same data) share one actual set of network
   calls per request instead of two. Only dedupes within a single
   request/render pass, not across a Server Action call and the page
   re-render that follows it — those are genuinely separate requests.

   vas/schools (Phase 1), tasks/email tracker items/checklist template
   & progress/task categories (Phase 2), and suggestions/general notes/
   private notes (Phase 3) are read from their own tables — see
   docs/superpowers/specs/2026-09-02-relational-backend-design.md.
   Everything else (schoolData's vaAssigned/notes, communicationEditor,
   emailTemplates, contactGroups, etc.) still comes from the app_state
   blob until its own phase migrates it. Whatever values happen to
   still be sitting in the blob for already-migrated fields are ignored
   entirely — they're stale leftovers, not read here on purpose. */
export const fetchAppState = cache(async (): Promise<AppState | null> => {
  // The login page's "See a demo" link sets this cookie instead of a real
  // Supabase session -- short-circuit straight to the demo visitor's own
  // cookie-backed state (lib/demo-session.ts) rather than running the
  // ~25-table Promise.all below against the real database at all.
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";
  if (isDemo) return getDemoState();

  return loadAppState(await createClient());
});

type DbClient = Awaited<ReturnType<typeof createClient>>;

/* The actual read, with the database connection passed in -- so the
   automatic nightly backup (lib/automatic-backup.ts) can run the exact
   same load with the service-key connection when no one is signed in. */
export async function loadAppState(supabase: DbClient): Promise<AppState | null> {
  const [
    blobResult,
    vasResult,
    schoolsResult,
    taskCategoriesResult,
    checklistTemplateResult,
    checklistProgressResult,
    taskFilesResult,
    taskFileCategoriesResult,
    emailTrackerResult,
    suggestionsResult,
    generalNotesResult,
    generalNoteCommentsResult,
    privateNotesResult,
    privateNoteCommentsResult,
    emailTemplatesResult,
    contactGroupsResult,
    contactRowsResult,
    distributionGroupsResult,
    distributionRowsResult,
    settingsResult,
    eodReportsResult,
    issuesResult,
    issueCategoriesResult,
    issueSubcategoriesResult,
    issueCommentsResult,
    mentionsResult,
    accessRequestsResult,
    schoolContactsResult,
    otherContactsResult,
    generalTasksResult,
    generalTaskCategoriesResult,
    planItemsResult,
    workNotesResult,
    shiftStateResult,
    suggestionDetailsResult,
    suggestionAttachmentsResult,
    issueTypesResult,
    issueTypeLinksResult,
    emailDoneResult,
  ] = await Promise.all([
    supabase.from("app_state").select("data").eq("id", 1).maybeSingle(),
    supabase.from("vas").select("id, name, email, admin, communication_access, role, color").order("name"),
    supabase.from("schools").select("id, name, website, address, phone, fax, hours, email_notes").order("name"),
    supabase.from("task_categories").select("id, name, school_id, has_count, eod_phrase").order("sort_order"),
    supabase.from("checklist_template").select("id, description, school_id, task_category_id").order("sort_order"),
    supabase.from("checklist_progress").select("school_id, template_item_id, status, checked_by, not_needed"),
    supabase.from("task_files").select("id, school_id, table_id, file_name, sort_order, created_at").order("sort_order"),
    supabase.from("task_file_categories").select("id, task_file_id, category_id, status, va_assigned, count, comms_status, comms_va_assigned, sort_order, created_at, status_changed_at").order("sort_order"),
    supabase.from("email_tracker_items").select("id, school_id, description, status, added_by, created_at").order("created_at"),
    supabase.from("suggestions").select("id, text, author, status, created_at").order("created_at"),
    supabase.from("general_notes").select("id, text, author, urgency, ack_by, comment_ack_by, created_at, pad_color").order("created_at"),
    supabase.from("general_note_comments").select("id, note_id, author, text, created_at, edited_at").order("created_at"),
    supabase.from("private_notes").select("id, text, author, shared_with, ack_by, comment_ack_by, created_at, pad_color, board_x, board_y, board_rotation, board_width, board_height, board_z, is_reminder").order("created_at"),
    supabase.from("private_note_comments").select("id, note_id, author, text, created_at, edited_at").order("created_at"),
    supabase.from("email_templates").select("id, name, category, subject, body").order("sort_order"),
    supabase.from("contact_groups").select("id, name").order("sort_order"),
    supabase.from("contact_rows").select("id, group_id, school, principal, principal_email, asst_principal, asst_principal_email, front_desk, front_desk_email, nurse_name, nurse_email, notes").order("sort_order"),
    supabase.from("distribution_groups").select("id, name").order("sort_order"),
    supabase.from("distribution_rows").select("id, group_id, school, enrolled, distributed, classroom_regular, classroom_launch, classroom_crr, consent_packets, contact_person, remarks, breakdown").order("sort_order"),
    supabase.from("settings").select("key, value").in("key", ["nurseLeader", "communicationEditor"]),
    supabase.from("eod_reports").select("id, author, date, time_in, break_start, break_end, time_out, total_hours, tasks, created_at").order("created_at"),
    supabase.from("issues").select("id, type, reported_by, status, created_at, description, category, subcategory, remarks, student_name, dob, insurance_number, school_year, file_name, page_number, correcting_category, correct_info, correction_kind, student_record_link, needs_name_correction, needs_dob_correction, needs_insurance_correction, needs_other_correction, other_correction_detail, question, fixed_by, fix_note, comment_ack_by").order("created_at"),
    supabase.from("issue_categories").select("id, name").order("sort_order"),
    supabase.from("issue_subcategories").select("id, category_id, name").order("sort_order"),
    supabase.from("issue_comments").select("id, issue_id, author, text, created_at, edited_at").order("created_at"),
    supabase.from("mentions").select("id, mentioned_name, mentioner_name, source, issue_id, note_id, snippet, created_at, read_at").order("created_at", { ascending: false }),
    supabase.from("access_requests").select("id, record_kind, school_id, target_id, label, reason, requested_by, status, resolved_by, resolved_at, created_at").order("created_at"),
    supabase.from("school_contacts").select("id, school_id, position, name, email, created_at").order("created_at"),
    supabase.from("other_contacts").select("id, name, organization, email, phone, notes").order("created_at"),
    supabase.from("general_tasks").select("id, category, description, status, va_assigned, created_at, status_changed_at").order("created_at"),
    supabase.from("general_task_categories").select("id, name").order("sort_order"),
    supabase.from("plan_items").select("id, kind, va_name, school_id, task_file_category_id, general_task_id, label, created_by, created_at, suggested_school_id, suggested_category_id, suggested_file_name, note_id, completed_at, sort_order, assigned_to").order("created_at"),
    supabase.from("work_notes").select("item_key, va_name, note, updated_at"),
    supabase.from("shift_state").select("va_name, status, changed_at"),
    // Both tolerant: until phase65's SQL is run these just come back empty.
    supabase.from("suggestions").select("id, details"),
    supabase.from("suggestion_attachments").select("id, suggestion_id, path, name, type, size, created_at").order("created_at"),
      // Tolerant like the two above: until supabase/phase66_issue_types.sql has been run
    // these fail, which just means "no custom issue types" instead of failing the whole load.
    supabase.from("issue_types").select("id, name").order("sort_order"),
    supabase.from("issues").select("id, custom_type_id"),
    // Tolerant too: until phase67_email_done_at.sql has been run this fails, which just
    // means finished email items don't show on Currently Working On.
    supabase.from("email_tracker_items").select("id, done_at"),
  ]);

  if (blobResult.error || !blobResult.data) return null;
  if (vasResult.error) return null;
  if (schoolsResult.error) return null;
  if (taskCategoriesResult.error) return null;
  if (checklistTemplateResult.error) return null;
  if (checklistProgressResult.error) return null;
  if (taskFilesResult.error) return null;
  if (taskFileCategoriesResult.error) return null;
  if (emailTrackerResult.error) return null;
  if (suggestionsResult.error) return null;
  if (generalNotesResult.error) return null;
  if (generalNoteCommentsResult.error) return null;
  if (privateNotesResult.error) return null;
  if (privateNoteCommentsResult.error) return null;
  if (emailTemplatesResult.error) return null;
  if (contactGroupsResult.error) return null;
  if (contactRowsResult.error) return null;
  if (distributionGroupsResult.error) return null;
  if (distributionRowsResult.error) return null;
  if (settingsResult.error) return null;
  if (eodReportsResult.error) return null;
  if (issuesResult.error) return null;
  if (issueCategoriesResult.error) return null;
  if (issueCommentsResult.error) return null;
  if (mentionsResult.error) return null;
  if (issueSubcategoriesResult.error) return null;
  if (accessRequestsResult.error) return null;
  if (schoolContactsResult.error) return null;
  if (otherContactsResult.error) return null;
  if (generalTasksResult.error) return null;
  if (generalTaskCategoriesResult.error) return null;

  const state = blobResult.data.data as AppState;
  state.vas = (vasResult.data || []).map(mapVaRow);
  state.schools = (schoolsResult.data || []).map((r) => mapSchoolRow(r as SchoolRow));
  state.taskCategories = (taskCategoriesResult.data || []).map((row) => ({ id: row.id, name: row.name, schoolId: row.school_id ?? undefined, hasCount: !!row.has_count, eodPhrase: row.eod_phrase ?? undefined })) as TaskCategory[];
  state.checklistTemplate = (checklistTemplateResult.data || []).map((row) => ({ id: row.id, description: row.description, schoolId: row.school_id ?? undefined, taskCategoryId: row.task_category_id ?? undefined })) as ChecklistTemplateItem[];
  const suggestionDetails = new Map<string, string>();
  if (!suggestionDetailsResult.error) {
    for (const row of (suggestionDetailsResult.data || []) as { id: string; details: string | null }[]) {
      if (row.details) suggestionDetails.set(row.id, row.details);
    }
  }
  const suggestionAttachments = new Map<string, SuggestionAttachment[]>();
  if (!suggestionAttachmentsResult.error) {
    for (const row of (suggestionAttachmentsResult.data || []) as { id: string; suggestion_id: string; path: string; name: string; type: string; size: number }[]) {
      const list = suggestionAttachments.get(row.suggestion_id) ?? [];
      list.push({ id: row.id, path: row.path, name: row.name, type: row.type, size: Number(row.size) || 0 });
      suggestionAttachments.set(row.suggestion_id, list);
    }
  }
  state.suggestions = (suggestionsResult.data || []).map((r) => {
    const base = mapSuggestionRow(r as SuggestionRow);
    return { ...base, details: suggestionDetails.get(base.id), attachments: suggestionAttachments.get(base.id) };
  });
  const generalNoteCommentsByNoteId = new Map<string, Comment[]>();
  for (const c of (generalNoteCommentsResult.data || []) as NoteCommentRow[]) {
    const list = generalNoteCommentsByNoteId.get(c.note_id) ?? [];
    list.push(mapNoteCommentRow(c));
    generalNoteCommentsByNoteId.set(c.note_id, list);
  }
  state.generalNotes = (generalNotesResult.data || []).map((r) => ({
    ...mapGeneralNoteRow(r as GeneralNoteRow),
    comments: generalNoteCommentsByNoteId.get((r as GeneralNoteRow).id) || [],
  }));

  const privateNoteCommentsByNoteId = new Map<string, Comment[]>();
  for (const c of (privateNoteCommentsResult.data || []) as NoteCommentRow[]) {
    const list = privateNoteCommentsByNoteId.get(c.note_id) ?? [];
    list.push(mapNoteCommentRow(c));
    privateNoteCommentsByNoteId.set(c.note_id, list);
  }
  state.privateNotes = (privateNotesResult.data || []).map((r) => ({
    ...mapPrivateNoteRow(r as PrivateNoteRow),
    comments: privateNoteCommentsByNoteId.get((r as PrivateNoteRow).id) || [],
  }));

  state.checklistProgress = {};
  for (const row of checklistProgressResult.data || []) {
    state.checklistProgress[`${row.school_id}:${row.template_item_id}`] = {
      status: row.status,
      checkedBy: row.checked_by ?? undefined,
      notNeeded: row.not_needed ?? false,
    };
  }

  /* Fresh tasks/emailTracker replace whatever the blob still carries
     (stale leftovers, same as vas/schools in Phase 1) — every existing
     schoolData entry's arrays are cleared first so a school never ends
     up with duplicated or stale items merged with the tables' fresh
     data. vaAssigned/notes are left untouched — those fields aren't
     migrating this phase. */
  state.schoolData = state.schoolData || {};
  for (const sd of Object.values(state.schoolData)) {
    sd.tasks = [];
    sd.taskFiles = [];
    sd.emailTracker = [];
  }
  const categoryNames = new Map((taskCategoriesResult.data || []).map((row) => [row.id, row.name]));
  const assignments = (taskFileCategoriesResult.data || []).map((row) => {
    const item = row as TaskFileCategoryRow;
    return {
      id: item.id,
      taskFileId: item.task_file_id,
      createdAt: item.created_at,
      categoryId: item.category_id,
      category: categoryNames.get(item.category_id) || "Uncategorized",
      status: item.status,
      vaAssigned: item.va_assigned || [],
      sortOrder: item.sort_order,
      count: item.count == null ? undefined : String(item.count),
      commsStatus: item.comms_status ?? undefined,
      commsVaAssigned: item.comms_va_assigned ?? undefined,
    } satisfies TaskFileCategory;
  });
  const assignmentsByFile = new Map<string, TaskFileCategory[]>();
  for (const assignment of assignments) {
    const items = assignmentsByFile.get(assignment.taskFileId) || [];
    items.push(assignment);
    assignmentsByFile.set(assignment.taskFileId, items);
  }
  for (const row of taskFilesResult.data || []) {
    const fileRow = row as TaskFileRow;
    if (!state.schoolData[fileRow.school_id]) state.schoolData[fileRow.school_id] = { vaAssigned: "" };
    const sd = state.schoolData[fileRow.school_id];
    const file = groupTaskFileRows([{
      id: fileRow.id,
      tableId: fileRow.table_id ?? undefined,
      fileName: fileRow.file_name,
      sortOrder: fileRow.sort_order,
      createdAt: fileRow.created_at,
    }], assignmentsByFile.get(fileRow.id) || [])[0];
    (sd.taskFiles ??= []).push(file);
    for (const assignment of file.categories) {
      (sd.tasks ??= []).push({
        id: assignment.id,
        category: assignment.category,
        fileName: file.fileName,
        count: assignment.count,
        status: assignment.status,
        vaAssigned: assignment.vaAssigned,
        createdAt: assignment.createdAt || file.createdAt,
        sortOrder: file.sortOrder,
        commsStatus: assignment.commsStatus,
        commsVaAssigned: assignment.commsVaAssigned,
      });
    }
  }
  const emailDoneAt = new Map<string, string>();
  if (!emailDoneResult.error) {
    for (const row of (emailDoneResult.data || []) as { id: string; done_at: string | null }[]) {
      if (row.done_at) emailDoneAt.set(row.id, row.done_at);
    }
  }
  for (const e of emailTrackerResult.data || []) {
    if (!state.schoolData[e.school_id]) state.schoolData[e.school_id] = { vaAssigned: "" };
    const sd = state.schoolData[e.school_id];
    sd.emailTracker = sd.emailTracker || [];
    const doneAt = emailDoneAt.get(e.id);
    sd.emailTracker.push({ ...mapEmailTrackerRow(e as EmailTrackerRow), ...(doneAt ? { doneAt } : {}) });
  }

  state.emailTemplates = (emailTemplatesResult.data || []).map((r) => mapEmailTemplateRow(r as EmailTemplateRow));

  const contactGroupsById = new Map<string, ContactGroup>();
  for (const g of (contactGroupsResult.data || []) as ContactGroupRow[]) {
    contactGroupsById.set(g.id, { id: g.id, name: g.name, rows: [] });
  }
  for (const r of (contactRowsResult.data || []) as ContactRowDbRow[]) {
    const group = contactGroupsById.get(r.group_id);
    if (group) group.rows.push(mapContactRowDbRow(r));
  }
  state.contactGroups = Array.from(contactGroupsById.values());

  state.otherContacts = (otherContactsResult.data || []).map((r) => mapOtherContactRow(r as OtherContactRow));

  state.generalTasks = (generalTasksResult.data || []).map((r) => mapGeneralTaskRow(r as GeneralTaskRow));
  state.generalTaskCategories = (generalTaskCategoriesResult.data || []) as GeneralTaskCategory[];

  state.planItems = (planItemsResult.data || []).map((r) => mapPlanItemRow(r as PlanItemRow));
  // Tolerant on purpose: if the work_notes table isn't there yet (its SQL
  // not run), the app just shows no notes instead of failing every page.
  state.workNotes = workNotesResult.error
    ? []
    : ((workNotesResult.data || []) as { item_key: string; va_name: string; note: string; updated_at: string }[]).map((r) => ({
        itemKey: r.item_key,
        vaName: r.va_name,
        note: r.note,
        updatedAt: r.updated_at,
      }));
  // Tolerant like work notes: without the shift_state table, nobody is
  // "in a shift", so both buttons behave (Start on, End off).
  state.shiftStates = shiftStateResult.error
    ? []
    : ((shiftStateResult.data || []) as { va_name: string; status: "working" | "ended"; changed_at: string }[]).map((r) => ({
        vaName: r.va_name,
        status: r.status,
        changedAt: r.changed_at,
      }));
  state.statusChangedAt = {
    ...Object.fromEntries((taskFileCategoriesResult.data || []).map((r) => [(r as { id: string }).id, (r as { status_changed_at: string }).status_changed_at])),
    ...Object.fromEntries((generalTasksResult.data || []).map((r) => [(r as { id: string }).id, (r as { status_changed_at: string }).status_changed_at])),
  };

  const distributionGroupsById = new Map<string, DistributionGroup>();
  for (const g of (distributionGroupsResult.data || []) as DistributionGroupRow[]) {
    distributionGroupsById.set(g.id, { id: g.id, name: g.name, rows: [] });
  }
  for (const r of (distributionRowsResult.data || []) as DistributionRowDbRow[]) {
    const group = distributionGroupsById.get(r.group_id);
    if (group) group.rows.push(mapDistributionRowDbRow(r));
  }
  state.distributionGroups = Array.from(distributionGroupsById.values());

  const settingsByKey = new Map((settingsResult.data || []).map((s) => [s.key, s.value]));
  const nurseLeaderValue = settingsByKey.get("nurseLeader") as NurseLeader | undefined;
  state.nurseLeader = nurseLeaderValue || { name: "", email: "" };
  const communicationEditorValue = settingsByKey.get("communicationEditor") as { value?: string } | undefined;
  state.communicationEditor = communicationEditorValue?.value || undefined;

  state.eodReports = (eodReportsResult.data || []).map((r) => mapEodReportRow(r as EodReportRow));

  const issueCommentsByIssueId = new Map<string, Comment[]>();
  for (const c of (issueCommentsResult.data || []) as IssueCommentRow[]) {
    const list = issueCommentsByIssueId.get(c.issue_id) ?? [];
    list.push(mapIssueCommentRow(c));
    issueCommentsByIssueId.set(c.issue_id, list);
  }
  const customTypeByIssueId = new Map<string, string>();
  if (!issueTypesResult.error && !issueTypeLinksResult.error) {
    for (const row of (issueTypeLinksResult.data || []) as { id: string; custom_type_id: string | null }[]) {
      if (row.custom_type_id) customTypeByIssueId.set(row.id, row.custom_type_id);
    }
  }
  state.issueTypes = issueTypesResult.error ? [] : (issueTypesResult.data || []).map((t) => ({ id: t.id as string, name: t.name as string }));
  state.issues = (issuesResult.data || []).map((r) => {
    const id = (r as unknown as IssueRow).id;
    const customTypeId = customTypeByIssueId.get(id);
    return {
      ...mapIssueRow(r as unknown as IssueRow),
      ...(customTypeId ? { customTypeId } : {}),
      comments: issueCommentsByIssueId.get(id) || [],
    };
  });
  state.mentions = (mentionsResult.data || []).map((r) => mapMentionRow(r as MentionRow));

  state.issueCategories = (issueCategoriesResult.data || []).map(
    (c): IssueCategory => ({
      id: c.id,
      name: c.name,
      subcategories: (issueSubcategoriesResult.data || [])
        .filter((s) => s.category_id === c.id)
        .map((s) => ({ id: s.id, name: s.name })),
    })
  );
  state.accessRequests = (accessRequestsResult.data || []).map((r) => mapAccessRequestRow(r as AccessRequestRow));

  state.schoolContacts = {};
  for (const r of (schoolContactsResult.data || []) as SchoolContactRow[]) {
    if (!state.schoolContacts[r.school_id]) state.schoolContacts[r.school_id] = [];
    state.schoolContacts[r.school_id].push(mapSchoolContactRow(r));
  }

  return state;
}
