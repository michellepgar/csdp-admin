import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AppState,
  Va,
  School,
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
  NurseLeader,
  EodReport,
} from "@/lib/app-state";

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
    settingsResult,
    eodReportsResult,
  ] = await Promise.all([
    supabase.from("app_state").select("data").eq("id", 1).single(),
    supabase.from("vas").select("id, name, email, admin, role, color").order("name"),
    supabase.from("schools").select("id, name").order("name"),
    supabase.from("task_categories").select("id, name").order("sort_order"),
    supabase.from("checklist_template").select("id, description").order("sort_order"),
    supabase.from("checklist_progress").select("school_id, template_item_id, status"),
    supabase.from("tasks").select("id, school_id, category, file_name, count, status, va_assigned, created_at").order("created_at"),
    supabase.from("email_tracker_items").select("id, school_id, description, status, added_by, created_at").order("created_at"),
    supabase.from("suggestions").select("id, text, author, status, created_at").order("created_at"),
    supabase.from("general_notes").select("id, text, author, urgency, ack_by, created_at").order("created_at"),
    supabase.from("private_notes").select("id, text, author, shared_with, ack_by, created_at").order("created_at"),
    supabase.from("email_templates").select("id, name, category, subject, body").order("sort_order"),
    supabase.from("contact_groups").select("id, name").order("sort_order"),
    supabase.from("contact_rows").select("id, group_id, school, principal, principal_email, asst_principal, asst_principal_email, front_desk, front_desk_email, nurse_name, nurse_email, notes").order("sort_order"),
    supabase.from("settings").select("key, value").in("key", ["nurseLeader", "communicationEditor"]),
    supabase.from("eod_reports").select("id, author, date, time_in, break_start, break_end, time_out, total_hours, tasks, created_at").order("created_at"),
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
  if (settingsResult.error) return null;
  if (eodReportsResult.error) return null;

  const state = blobResult.data.data as AppState;
  state.vas = (vasResult.data || []).map(mapVaRow);
  state.schools = (schoolsResult.data || []) as School[];
  state.taskCategories = (taskCategoriesResult.data || []) as TaskCategory[];
  state.checklistTemplate = (checklistTemplateResult.data || []) as ChecklistTemplateItem[];
  state.suggestions = (suggestionsResult.data || []).map((r) => mapSuggestionRow(r as SuggestionRow));
  state.generalNotes = (generalNotesResult.data || []).map((r) => mapGeneralNoteRow(r as GeneralNoteRow));
  state.privateNotes = (privateNotesResult.data || []).map((r) => mapPrivateNoteRow(r as PrivateNoteRow));

  state.checklistProgress = {};
  for (const row of checklistProgressResult.data || []) {
    state.checklistProgress[`${row.school_id}:${row.template_item_id}`] = { status: row.status };
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

  const settingsByKey = new Map((settingsResult.data || []).map((s) => [s.key, s.value]));
  const nurseLeaderValue = settingsByKey.get("nurseLeader") as NurseLeader | undefined;
  state.nurseLeader = nurseLeaderValue || { name: "", email: "" };
  const communicationEditorValue = settingsByKey.get("communicationEditor") as { value?: string } | undefined;
  state.communicationEditor = communicationEditorValue?.value || undefined;

  state.eodReports = (eodReportsResult.data || []).map((r) => mapEodReportRow(r as EodReportRow));

  return state;
});
