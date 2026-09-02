import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppState, Va, School, Task, EmailTrackerItem, ChecklistTemplateItem, TaskCategory } from "@/lib/app-state";

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

   vas/schools (Phase 1) and tasks/email tracker items/checklist
   template & progress/task categories (Phase 2) are read from their
   own tables — see docs/superpowers/specs/2026-09-02-relational-backend-design.md.
   Everything else (schoolData's vaAssigned/notes, communicationEditor,
   suggestions, etc.) still comes from the app_state blob until its own
   phase migrates it. Whatever values happen to still be sitting in the
   blob for already-migrated fields are ignored entirely — they're
   stale leftovers, not read here on purpose. */
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
  ] = await Promise.all([
    supabase.from("app_state").select("data").eq("id", 1).single(),
    supabase.from("vas").select("id, name, email, admin, role, color").order("name"),
    supabase.from("schools").select("id, name").order("name"),
    supabase.from("task_categories").select("id, name").order("created_at"),
    supabase.from("checklist_template").select("id, description").order("created_at"),
    supabase.from("checklist_progress").select("school_id, template_item_id, status"),
    supabase.from("tasks").select("id, school_id, category, file_name, count, status, va_assigned, created_at").order("created_at"),
    supabase.from("email_tracker_items").select("id, school_id, description, status, added_by, created_at").order("created_at"),
  ]);

  if (blobResult.error || !blobResult.data) return null;
  if (vasResult.error) return null;
  if (schoolsResult.error) return null;
  if (taskCategoriesResult.error) return null;
  if (checklistTemplateResult.error) return null;
  if (checklistProgressResult.error) return null;
  if (tasksResult.error) return null;
  if (emailTrackerResult.error) return null;

  const state = blobResult.data.data as AppState;
  state.vas = (vasResult.data || []).map(mapVaRow);
  state.schools = (schoolsResult.data || []) as School[];
  state.taskCategories = (taskCategoriesResult.data || []) as TaskCategory[];
  state.checklistTemplate = (checklistTemplateResult.data || []) as ChecklistTemplateItem[];

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

  return state;
});
