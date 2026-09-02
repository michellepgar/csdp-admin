import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AppState,
  Va,
  School,
  SchoolContact,
  Task,
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
  AccessRequest,
} from "@/lib/app-state";

type SchoolRow = { id: string; name: string; website: string | null; hours: string | null; no_recheck: boolean | null };

function mapSchoolRow(r: SchoolRow): School {
  return { id: r.id, name: r.name, website: r.website ?? undefined, hours: r.hours ?? undefined, noRecheck: r.no_recheck ?? false };
}

type VaRow = {
  id: string;
  name: string;
  email: string | null;
  admin: boolean | null;
  role: string | null;
  color: string | null;
};

function mapVaRow(r: VaRow): Va {
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    admin: r.admin ?? undefined,
    role: r.role ?? undefined,
    color: r.color ?? undefined,
  };
}

type TaskRow = {
  id: string;
  school_id: string;
  category: string;
  file_name: string;
  count: string | null;
  status: string;
  va_assigned: string[];
  created_at: string;
  comms_status: string | null;
  comms_va_assigned: string[] | null;
};

function mapTaskRow(r: TaskRow): Task {
  return {
    id: r.id,
    category: r.category,
    fileName: r.file_name,
    count: r.count ?? undefined,
    status: r.status,
    vaAssigned: r.va_assigned,
    createdAt: r.created_at,
    commsStatus: r.comms_status ?? undefined,
    commsVaAssigned: r.comms_va_assigned ?? undefined,
  };
}

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
  created_at: string;
};

function mapGeneralNoteRow(r: GeneralNoteRow): GeneralNote {
  return {
    id: r.id,
    text: r.text,
    author: r.author,
    urgency: (r.urgency as "Urgent" | "" | null) ?? undefined,
    ackBy: r.ack_by,
    createdAt: r.created_at,
  };
}

type PrivateNoteRow = {
  id: string;
  text: string;
  author: string;
  shared_with: string[];
  ack_by: string[];
  created_at: string;
};

function mapPrivateNoteRow(r: PrivateNoteRow): PrivateNote {
  return {
    id: r.id,
    text: r.text,
    author: r.author,
    sharedWith: r.shared_with,
    ackBy: r.ack_by,
    createdAt: r.created_at,
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
  contact_person: string | null;
  remarks: string | null;
  breakdown: Record<string, Record<string, DistributionCell>>;
};

function mapDistributionRowDbRow(r: DistributionRowDbRow): DistributionRow {
  return {
    id: r.id,
    school: r.school,
    enrolled: r.enrolled ?? undefined,
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

type IssueRow = {
  id: string;
  type: string;
  reported_by: string;
  status: string;
  created_at: string;
  description: string | null;
  category: string | null;
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
  };
}

type SchoolContactRow = { id: string; school_id: string; position: string; email: string; created_at: string };

function mapSchoolContactRow(r: SchoolContactRow): SchoolContact {
  return { id: r.id, position: r.position, email: r.email, createdAt: r.created_at };
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
  const supabase = await createClient();

  const [
    blobResult,
    vasResult,
    schoolsResult,
    taskCategoriesResult,
    checklistTemplateResult,
    checklistProgressResult,
    tasksResult,
    emailTrackerResult,
    suggestionsResult,
    generalNotesResult,
    privateNotesResult,
    emailTemplatesResult,
    contactGroupsResult,
    contactRowsResult,
    distributionGroupsResult,
    distributionRowsResult,
    settingsResult,
    eodReportsResult,
    issuesResult,
    accessRequestsResult,
    schoolContactsResult,
    otherContactsResult,
  ] = await Promise.all([
    supabase.from("app_state").select("data").eq("id", 1).single(),
    supabase.from("vas").select("id, name, email, admin, role, color").order("name"),
    supabase.from("schools").select("id, name, website, hours, no_recheck").order("name"),
    supabase.from("task_categories").select("id, name").order("sort_order"),
    supabase.from("checklist_template").select("id, description").order("sort_order"),
    supabase.from("checklist_progress").select("school_id, template_item_id, status, checked_by"),
    supabase.from("tasks").select("id, school_id, category, file_name, count, status, va_assigned, created_at, comms_status, comms_va_assigned").order("created_at"),
    supabase.from("email_tracker_items").select("id, school_id, description, status, added_by, created_at").order("created_at"),
    supabase.from("suggestions").select("id, text, author, status, created_at").order("created_at"),
    supabase.from("general_notes").select("id, text, author, urgency, ack_by, created_at").order("created_at"),
    supabase.from("private_notes").select("id, text, author, shared_with, ack_by, created_at").order("created_at"),
    supabase.from("email_templates").select("id, name, category, subject, body").order("sort_order"),
    supabase.from("contact_groups").select("id, name").order("sort_order"),
    supabase.from("contact_rows").select("id, group_id, school, principal, principal_email, asst_principal, asst_principal_email, front_desk, front_desk_email, nurse_name, nurse_email, notes").order("sort_order"),
    supabase.from("distribution_groups").select("id, name").order("sort_order"),
    supabase.from("distribution_rows").select("id, group_id, school, enrolled, contact_person, remarks, breakdown").order("sort_order"),
    supabase.from("settings").select("key, value").in("key", ["nurseLeader", "communicationEditor"]),
    supabase.from("eod_reports").select("id, author, date, time_in, break_start, break_end, time_out, total_hours, tasks, created_at").order("created_at"),
    supabase.from("issues").select("id, type, reported_by, status, created_at, description, category, remarks, student_name, dob, insurance_number, school_year, file_name, page_number, correcting_category, correct_info, correction_kind, student_record_link, needs_name_correction, needs_dob_correction, needs_insurance_correction, needs_other_correction, other_correction_detail, question, fixed_by").order("created_at"),
    supabase.from("access_requests").select("id, record_kind, school_id, target_id, label, reason, requested_by, status, resolved_by, resolved_at, created_at").order("created_at"),
    supabase.from("school_contacts").select("id, school_id, position, email, created_at").order("created_at"),
    supabase.from("other_contacts").select("id, name, organization, email, phone, notes").order("created_at"),
  ]);

  if (blobResult.error || !blobResult.data) return null;
  if (vasResult.error) return null;
  if (schoolsResult.error) return null;
  if (taskCategoriesResult.error) return null;
  if (checklistTemplateResult.error) return null;
  if (checklistProgressResult.error) return null;
  if (tasksResult.error) return null;
  if (emailTrackerResult.error) return null;
  if (suggestionsResult.error) return null;
  if (generalNotesResult.error) return null;
  if (privateNotesResult.error) return null;
  if (emailTemplatesResult.error) return null;
  if (contactGroupsResult.error) return null;
  if (contactRowsResult.error) return null;
  if (distributionGroupsResult.error) return null;
  if (distributionRowsResult.error) return null;
  if (settingsResult.error) return null;
  if (eodReportsResult.error) return null;
  if (issuesResult.error) return null;
  if (accessRequestsResult.error) return null;
  if (schoolContactsResult.error) return null;
  if (otherContactsResult.error) return null;

  const state = blobResult.data.data as AppState;
  state.vas = (vasResult.data || []).map(mapVaRow);
  state.schools = (schoolsResult.data || []).map((r) => mapSchoolRow(r as SchoolRow));
  state.taskCategories = (taskCategoriesResult.data || []) as TaskCategory[];
  state.checklistTemplate = (checklistTemplateResult.data || []) as ChecklistTemplateItem[];
  state.suggestions = (suggestionsResult.data || []).map((r) => mapSuggestionRow(r as SuggestionRow));
  state.generalNotes = (generalNotesResult.data || []).map((r) => mapGeneralNoteRow(r as GeneralNoteRow));
  state.privateNotes = (privateNotesResult.data || []).map((r) => mapPrivateNoteRow(r as PrivateNoteRow));

  state.checklistProgress = {};
  for (const row of checklistProgressResult.data || []) {
    state.checklistProgress[`${row.school_id}:${row.template_item_id}`] = {
      status: row.status,
      checkedBy: row.checked_by ?? undefined,
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
    sd.emailTracker = [];
  }
  for (const t of tasksResult.data || []) {
    if (!state.schoolData[t.school_id]) state.schoolData[t.school_id] = { vaAssigned: "" };
    const sd = state.schoolData[t.school_id];
    sd.tasks = sd.tasks || [];
    sd.tasks.push(mapTaskRow(t as unknown as TaskRow));
  }
  for (const e of emailTrackerResult.data || []) {
    if (!state.schoolData[e.school_id]) state.schoolData[e.school_id] = { vaAssigned: "" };
    const sd = state.schoolData[e.school_id];
    sd.emailTracker = sd.emailTracker || [];
    sd.emailTracker.push(mapEmailTrackerRow(e as EmailTrackerRow));
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

  state.issues = (issuesResult.data || []).map((r) => mapIssueRow(r as unknown as IssueRow));
  state.accessRequests = (accessRequestsResult.data || []).map((r) => mapAccessRequestRow(r as AccessRequestRow));

  state.schoolContacts = {};
  for (const r of (schoolContactsResult.data || []) as SchoolContactRow[]) {
    if (!state.schoolContacts[r.school_id]) state.schoolContacts[r.school_id] = [];
    state.schoolContacts[r.school_id].push(mapSchoolContactRow(r));
  }

  return state;
});
