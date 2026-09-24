/* Deliberately no imports of anything server-only (next/headers,
   @/lib/supabase/server) here — this file is imported by client
   components too (for shared types/constants like CONTACT_FIELDS), and
   pulling in a server-only module would drag it into the client bundle,
   which Next.js's build correctly refuses to do. fetchAppState() itself
   lives in lib/fetch-app-state.ts instead, kept server-only. */

import type { WorkspaceData } from "@/lib/workspace";
import type { SpreadsheetData } from "@/lib/spreadsheets";

export interface Va {
  id: string;
  name: string;
  email?: string;
  admin?: boolean;
  communicationAccess?: boolean;
  role?: string;
  color?: string;
}

export const SCHOOL_GROUPS = ["Pre-K", "Elementary School", "Middle School", "High School"];
export const CONTACT_POSITIONS = ["Principal", "Assistant Principal", "Front Desk", "Nurse"];

export interface School {
  id: string;
  name: string;
  website?: string;
  /** Same convention as website/phone/fax/hours below -- editable from
   *  the Contacts page's row edit form, only ever shown on the
   *  school's own page. */
  address?: string;
  phone?: string;
  fax?: string;
  /* Grade-level hours only now (e.g. "K-5 Hours: 9:00 a.m. - 3:15
     p.m.", one per line) -- phone/fax used to just be the first two
     lines of this same free-text block, split into their own fields
     above so each renders as its own labeled field on the school
     page instead of depending on line order. */
  hours?: string;
  /* One free-text note per school about its email situation, shown
     next to Email Tracker on the school page -- anyone on the team
     can edit it, no history kept (unlike, say, Issues & Concerns). */
  emailNotes?: string;
}

export interface SchoolContact {
  id: string;
  position: string;
  /** Optional -- lets a second (or third) contact for the same
   *  position (e.g. a school with two nurses) be told apart, since
   *  the primary Contacts-page fields only ever have room for one
   *  name+email per position. */
  name?: string;
  email: string;
  createdAt: string;
}

export interface ChecklistProgressEntry {
  status: string;
  /* Name of whoever last checked this off -- shown as a small signature
     next to the item. Anyone on the team can check a checklist item off
     (not just the assigned VA), so this records who actually did it. */
  checkedBy?: string;
  notNeeded?: boolean;
}

export interface TaskCategory {
  id: string;
  name: string;
  schoolId?: string;
  /** Whether this category's column gets a Count input -- toggled per
   *  category from the "Edit categories" panel (tasks-card.tsx)
   *  instead of being fixed to a hardcoded list of category names.
   *  Michelle: "we wont know when we need it" -- the Count column
   *  space is already always reserved on every table, blank where
   *  unused, so this just decides which categories actually get an
   *  input in it.
   *
   *  NOT a global property of the category -- schools don't all track
   *  the same category the same way, so this is resolved PER SCHOOL
   *  from AppState's taskCategoryCountsBySchool (see below) before a
   *  category object reaches a school's Tasks card. Only meaningful on
   *  a category list that's already been resolved for one school;
   *  state.taskCategories itself carries no real value here. */
  hasCount?: boolean;
  /** Optional wording used to build EOD-ready lines on Overview's
   *  Currently Working On list view, e.g. "Encode/Update Info, Upload"
   *  for a "Before Visit" category -- set per category from the "Edit
   *  categories" panel (tasks-card.tsx). Falls back to the category's
   *  own name when unset. */
  eodPhrase?: string;
}

export interface ChecklistTemplateItem {
  id: string;
  description: string;
  schoolId?: string;
  taskCategoryId?: string;
}

export function visibleSchoolItems<T extends { schoolId?: string }>(items: T[], schoolId: string): T[] {
  return items.filter((item) => !item.schoolId || item.schoolId === schoolId);
}

export interface Task {
  id: string;
  category: string;
  fileName: string;
  count?: string;
  status: string;
  vaAssigned: string[];
  createdAt: string;
  sortOrder: number;
  /* Initial/Follow up files often need a separate "we reached out about
     this record" trail, tracked against the SAME file name rather than
     as a second task row -- its own status/signatures, independent of
     the main status/vaAssigned above. Unused (undefined) for every
     other category. */
  commsStatus?: string;
  commsVaAssigned?: string[];
}

export function checklistSummary(
  template: ChecklistTemplateItem[],
  progress: Record<string, ChecklistProgressEntry>,
): { done: number; total: number } {
  const applicable = template.filter((item) => !progress[item.id]?.notNeeded);
  return {
    done: applicable.filter((item) => progress[item.id]?.status === "Done").length,
    total: applicable.length,
  };
}

export function nextChecklistNotNeededEntry(
  current: ChecklistProgressEntry | undefined,
  notNeeded: boolean,
): ChecklistProgressEntry {
  return notNeeded
    ? { status: "Open", notNeeded: true }
    : { status: current?.status === "Done" ? "Done" : "Open", ...(current?.checkedBy ? { checkedBy: current.checkedBy } : {}), notNeeded: false };
}

export interface TaskFileCategory {
  id: string;
  createdAt?: string;
  taskFileId: string;
  categoryId: string;
  category: string;
  status: string;
  vaAssigned: string[];
  sortOrder: number;
  count?: string;
  commsStatus?: string;
  commsVaAssigned?: string[];
}

export interface TaskFile {
  id: string;
  tableId?: string;
  fileName: string;
  sortOrder: number;
  createdAt: string;
  categories: TaskFileCategory[];
}

export function groupTaskFileRows(
  files: Omit<TaskFile, "categories">[],
  assignments: TaskFileCategory[],
): TaskFile[] {
  const byFile = new Map(files.map((file) => [file.id, { ...file, categories: [] as TaskFileCategory[] }]));
  for (const assignment of assignments) byFile.get(assignment.taskFileId)?.categories.push(assignment);
  return Array.from(byFile.values())
    .map((file) => ({ ...file, categories: file.categories.sort((a, b) => a.sortOrder - b.sortOrder || a.category.localeCompare(b.category)) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.fileName.localeCompare(b.fileName));
}

/* Categories where a task also gets its own parallel Communications
   status+signatures, shown alongside the main one on the same row. */
export const CATEGORIES_WITH_COMMUNICATIONS = ["Initial", "Follow up"];

/* Editable the same way a school's Tasks categories are (see
   TaskCategory/task_categories above) -- Michelle asked for the
   ability to manage this list herself rather than being stuck with a
   fixed one. Reuses TaskCategory's own shape (just {id, name}) since
   it's identical; general_task_categories is still its own separate
   table so a general-task category and a school-task category can
   never collide by id. */
export type GeneralTaskCategory = TaskCategory;

/* Work that isn't tied to any school -- shown on its own General Tasks
   page and, when "In Progress", alongside school Tasks in Overview's
   "Currently Working On". Deliberately a smaller shape than Task above
   (no count, no Communications sub-status): those exist for school
   paperwork specifics that don't apply here. */
export interface GeneralTask {
  id: string;
  category: string;
  description: string;
  status: string;
  vaAssigned: string[];
  createdAt: string;
}

export interface EmailTrackerItem {
  id: string;
  description: string;
  status: string;
  addedBy: string;
  createdAt: string;
  /** When it was marked Done (supabase/phase67_email_done_at.sql) -- lets it
   *  show on Overview's Currently Working On card as completed. */
  doneAt?: string;
}

export const TASK_STATUS_OPTIONS = ["", "In Progress", "Paused", "Completed", "Review"];
export const EMAIL_STATUS_OPTIONS = ["Needs My Response", "Waiting on Them", "Done"];

/* One row per pending "plan for tomorrow" item -- resolving one (the
   VA clicks Start/Review, or converts a priority into a real task)
   deletes its row; plan_items only ever holds items nobody has acted
   on yet, there's no history table (kind:"note" is the one exception --
   see completedAt below). kind:"task" links to a real school task
   (taskFileCategoryId) or General Task (generalTaskId); kind:
   "priority" is a boss-authored note with neither set yet -- acting on
   it creates the real task then deletes this row. kind:"note" pins a
   private note into "Your Plan" as a plain reminder (noteId), checked
   off rather than "started" -- see completedAt. vaName is who it's
   for; undefined means shared/unassigned (priority only -- task and
   note kinds are always someone's own). */
export interface PlanItem {
  id: string;
  kind: "task" | "priority" | "note";
  vaName?: string;
  schoolId?: string;
  taskFileCategoryId?: string;
  generalTaskId?: string;
  label: string;
  createdBy: string;
  createdAt: string;
  /** kind:"priority" only -- a boss-suggested destination for
   *  PlanPriorityStartForm to pre-fill when the VA starts it. All
   *  three are optional together; a plain free-text priority leaves
   *  them unset. */
  suggestedSchoolId?: string;
  suggestedCategoryId?: string;
  suggestedFileName?: string;
  /** kind:"note" only -- the private note this reminder points back to. */
  noteId?: string;
  /** kind:"note" only -- set when the reminder is checked off. The row
   *  is kept (not deleted) so it can still show up as "completed
   *  today" on Overview, unlike a resolved task/priority. */
  completedAt?: string;
  /** kind:"note" only -- set when "Start" is clicked on Your Plan. A
   *  started-but-not-completed reminder moves off Your Plan's Reminders
   *  list and shows "In Progress" on Currently Working On instead,
   *  matching how starting a task moves it there too (a reminder has no
   *  underlying task row to flip to In Progress, so this plan_item IS
   *  the record of that -- unlike a task, it isn't deleted on Start). */
  startedAt?: string;
  /** kind:"priority" only -- who the boss assigned it to. It stays in Task Priorities (not on their plan) until they grab it, at which point vaName is set. */
  assignedTo?: string;
  /** kind:"priority" only -- position in Task Priorities set by the admins (0 = top). */
  sortOrder?: number;
}

/* A VA's short explanation attached to one of their own tasks or
   reminders -- see lib/work-notes.ts and supabase/phase59_work_notes.sql. */
export interface WorkNote {
  itemKey: string;
  vaName: string;
  note: string;
  updatedAt: string;
}

export interface SchoolDataEntry {
  vaAssigned: string;
  tasks?: Task[];
  taskFiles?: TaskFile[];
  emailTracker?: EmailTrackerItem[];
  /* School Notes not ported yet — kept loose so "Reset all tasks"
     (Backup & School Year) can clear tasks/checklist without touching
     or corrupting whatever the HTML app already put here. */
  notes?: unknown[];
}

/* Used to restrict Tasks/Email Tracker edits to the one VA assigned to
   a school (or an admin) -- Michelle asked to drop that restriction so
   any signed-in team member can edit any school's records, matching
   the Yearly Checklist (which never had this restriction: "Anyone on
   the team can check a checklist item off"). Kept as a function
   (rather than inlining `true` at every call site) so the rule lives
   in exactly one place if it ever needs to change again. `sd` and
   `currentName` are unused now but left in the signature so every
   existing call site (components/tasks-card.tsx,
   components/email-tracker-card.tsx, app/(app)/schools/[id]/page.tsx
   and .../actions.ts) needs no changes. */
export function canEditSchoolRecords(sd: SchoolDataEntry | undefined, currentName: string, currentIsAdmin: boolean): boolean {
  void sd;
  void currentName;
  void currentIsAdmin;
  return true;
}

/* Where a person is in their working day: 'working' after Start my day, 'ended' after End Today's Work. */
export interface ShiftState {
  vaName: string;
  status: "working" | "ended";
  changedAt: string;
}

export interface SuggestionAttachment {
  id: string;
  /** Object path inside the private suggestion-attachments bucket. */
  path: string;
  name: string;
  type: string;
  size: number;
}

export interface Suggestion {
  id: string;
  /** The short headline. */
  text: string;
  /** The long description, if one was written. */
  details?: string;
  attachments?: SuggestionAttachment[];
  author: string;
  createdAt: string;
  status: "Requested" | "Working On It" | "Added";
}

/* Pad colors a note can be given -- a real sticky-note pad's own
   choices, not this app's teal palette, so this stays a fixed literal
   list rather than a theme token. */
export const NOTE_PAD_COLORS: { name: string; value: string }[] = [
  { name: "White", value: "#FFFFFF" },
  { name: "Pink", value: "#FFD6E8" },
  { name: "Yellow", value: "#FFF3B0" },
  { name: "Blue", value: "#CFE8FF" },
  { name: "Green", value: "#D4F5D4" },
];

/* Font colors offered in the note composer's toolbar -- same "fixed
   literal list" reasoning as NOTE_PAD_COLORS above. */
export const NOTE_FONT_COLORS: { name: string; value: string }[] = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#D92D20" },
  { name: "Blue", value: "#175CD3" },
  { name: "Pink", value: "#C0185F" },
  { name: "Green", value: "#1B7A3D" },
];

export interface GeneralNote {
  id: string;
  /* Sanitized HTML (bold/italic/underline, font family/size/color,
     bullet/checklist/hyphen lists), not plain text -- see
     components/sticky-note-composer.tsx (the editor that produces it)
     and lib/sanitize-note-html.ts (the sanitizer every save runs
     through before this ever reaches the database). */
  text: string;
  /** One of NOTE_PAD_COLORS' own values, or undefined for an
   *  older note saved before pad colors existed (renders as white). */
  padColor?: string;
  author: string;
  urgency?: "Urgent" | "";
  ackBy?: string[];
  createdAt: string;
  comments?: Comment[];
  /** VAs who have seen the LATEST comment -- same reset-on-new-comment
   *  blink-dot pattern as Issue.commentAckBy. */
  commentAckBy?: string[];
}

export interface PrivateNote {
  id: string;
  /** See GeneralNote's own `text` comment -- same sanitized-HTML shape. */
  text: string;
  padColor?: string;
  author: string;
  sharedWith?: string[];
  ackBy?: string[];
  createdAt: string;
  /** Only ever populated for a note the current viewer can already see
   *  (visiblePrivateNotes() filters the parent note before it crosses
   *  the server/client boundary -- see supabase/phase49_note_comments.sql's
   *  own comment on private_note_comments' RLS for why that's enough). */
  comments?: Comment[];
  commentAckBy?: string[];
  /** Position on the freeform pinboard (components/private-notes-board.tsx).
   *  Non-null boardX means this note lives on the board instead of the
   *  ordered list -- this is the ONLY signal used to decide that; there
   *  is no separate "isPinned" flag, so the two can't drift apart. */
  boardX?: number;
  boardY?: number;
  /** Degrees, e.g. -6 to 6 for the initial pin, freely adjustable after. */
  boardRotation?: number;
  /** Pixels. Undefined means "render at the board's default note size". */
  boardWidth?: number;
  boardHeight?: number;
  /** Stacking order -- higher draws on top. Recomputed server-side to
   *  current-max-plus-one whenever a note is touched, never client-set. */
  boardZ?: number;
  /** A quiet flag with no effect on this page itself -- makes this note
   *  selectable later from End Today's Work's "Add reminder" picker
   *  (as an alternative to typing a reminder as free text). */
  isReminder?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category?: string;
  subject: string;
  body: string;
}

export interface ContactRow {
  id: string;
  school: string;
  principal?: string;
  principalEmail?: string;
  asstPrincipal?: string;
  asstPrincipalEmail?: string;
  frontDesk?: string;
  frontDeskEmail?: string;
  nurseName?: string;
  nurseEmail?: string;
  notes?: string;
}

/* A contact not tied to any school (e.g. "District Office", "IT
   Support", a vendor) -- a flat list, unlike ContactRow/ContactGroup
   which are always grouped by school-type (Pre-K/Elementary/etc.). */
export interface OtherContact {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  rows: ContactRow[];
}

export interface NurseLeader {
  name: string;
  email: string;
}

/* Same nine contact fields as CONTACT_FIELDS below, but paired up by
   position (name + its email) for UI that needs to keep each pair
   together -- see app/(app)/schools/[id]/page.tsx's Contact Info card
   for why that matters. CONTACT_FIELDS itself stays flat because the
   Contacts page's table renders one column per field, where pairing
   doesn't apply. */
export const CONTACT_POSITION_GROUPS: { nameKey: keyof ContactRow; emailKey: keyof ContactRow; label: string }[] = [
  { nameKey: "principal", emailKey: "principalEmail", label: "Principal" },
  { nameKey: "asstPrincipal", emailKey: "asstPrincipalEmail", label: "Asst Principal" },
  { nameKey: "frontDesk", emailKey: "frontDeskEmail", label: "Front Desk" },
  { nameKey: "nurseName", emailKey: "nurseEmail", label: "Nurse" },
];

export const CONTACT_FIELDS: { key: keyof ContactRow; label: string }[] = [
  { key: "school", label: "School" },
  { key: "principal", label: "Principal" },
  { key: "principalEmail", label: "Email" },
  { key: "asstPrincipal", label: "Asst Principal" },
  { key: "asstPrincipalEmail", label: "Asst Principal Email" },
  { key: "frontDesk", label: "Front Desk" },
  { key: "frontDeskEmail", label: "Front Desk Email" },
  { key: "nurseName", label: "Nurse Name" },
  { key: "nurseEmail", label: "Nurse Email" },
  { key: "notes", label: "Notes" },
];

export interface EodReport {
  id: string;
  author: string;
  date: string;
  timeIn?: string;
  breakStart?: string;
  breakEnd?: string;
  timeOut?: string;
  totalHours?: string;
  tasks?: string[];
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  recordKind: "task" | "email-item";
  schoolId: string;
  targetId: string;
  label: string;
  reason: string;
  requestedBy: string;
  status: "pending" | "declined" | "fulfilled";
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AppState {
  schools: School[];
  vas: Va[];
  schoolData: Record<string, SchoolDataEntry>;
  /* Keyed by school id -- every contact person for that school, in no
     particular guaranteed order (fetch-app-state.ts pushes them in
     created_at order, but this isn't re-sorted defensively here). */
  schoolContacts?: Record<string, SchoolContact[]>;
  checklistTemplate: ChecklistTemplateItem[];
  checklistProgress: Record<string, ChecklistProgressEntry>;
  communicationEditor?: string;
  /* Optional, not required — existing app_state rows predate this field
     entirely (it's not just an empty array, the key itself is absent).
     Every read of this must fall back to [], same reasoning as the
     schoolData/emailTracker bug fixed in the HTML app. */
  suggestions?: Suggestion[];
  generalNotes?: GeneralNote[];
  privateNotes?: PrivateNote[];
  emailTemplates?: EmailTemplate[];
  contactGroups?: ContactGroup[];
  otherContacts?: OtherContact[];
  nurseLeader?: NurseLeader;
  eodReports?: EodReport[];
  taskCategories?: TaskCategory[];
  /** Which categories have their Count column turned on, per school --
   *  schoolId -> that school's own list of categoryIds. A category
   *  present here for one school and absent for another is exactly
   *  the point: the toggle in "Edit categories" is per school now, not
   *  shared across every school that happens to use the same category. */
  taskCategoryCountsBySchool?: Record<string, string[]>;
  accessRequests?: AccessRequest[];
  issues?: Issue[];
  mentions?: Mention[];
  /** Demo mode only -- real chat lives in its own tables (chat_messages / chat_reads), read directly by the messages actions rather than through fetchAppState(). */
  chatMessages?: import("@/lib/chat").ChatMessage[];
  chatReads?: Record<string, string>;
  workNotes?: WorkNote[];
  shiftStates?: ShiftState[];
  /** Present only on an AUTOMATIC nightly backup file (see lib/automatic-backup.ts). `excludes` lists what was left out on purpose -- currently "privateNotes" -- so Restore knows not to clear those. */
  backupMeta?: { automatic: boolean; createdAt: string; excludes: string[] };
  issueCategories?: IssueCategory[];
  /** Issue types the team added (see IssueCustomType). */
  issueTypes?: IssueCustomType[];
  distributionGroups?: DistributionGroup[];
  generalTasks?: GeneralTask[];
  generalTaskCategories?: GeneralTaskCategory[];
  /** Demo mode only: the demo visitor's My Workspace (real accounts read it straight from the database, see lib/workspace-data.ts). */
  workspace?: WorkspaceData;
  /** Demo mode only: the shared Spreadsheets (real accounts read them from the database, see lib/spreadsheet-data.ts). */
  spreadsheets?: SpreadsheetData;
  planItems?: PlanItem[];
  /* Keyed by task id (school task_file_categories row id) or General
     Task id -- when its status was last changed, per the DB trigger
     added in phase43. Used by todayActivityByVa (lib/shared-task-files.ts)
     to tell "completed today" apart from "completed a while ago". */
  statusChangedAt?: Record<string, string>;
}

/* ---------- Distribution List ----------
   Simplified from the HTML app on purpose: one current school year only
   (no year-switching/archive), and each classroom-type × language cell
   is a single "forms" number instead of the HTML app's 5-field packets/
   packetSize/loose/extraPackets/extraLoose breakdown with automatic
   packet-size math. Groups reuse the exact same shape as Schools
   Contact Information's groups. */
export const DISTRIBUTION_CLASSROOM_TYPES = [
  { key: "regular", label: "Regular Classroom" },
  { key: "launch", label: "Launch Classes" },
  { key: "crr", label: "CRR Classes" },
];
export const DISTRIBUTION_LANGUAGES = [
  { key: "engSpn", label: "ENG/SPN" },
  { key: "porFr", label: "POR/FR" },
  { key: "hc", label: "HC" },
];

// A cell holds the original HTML app's full packets/packetSize/loose/
// extraPackets/extraLoose breakdown (Michelle asked for that back, see
// git history) with automatic packet-size math. A brief period of this
// rewrite stored a single plain "forms" number per cell instead --
// still read here (as a DistributionCell union member) so that data
// doesn't crash the page or silently vanish.
export interface LegacyDistributionCell {
  packets?: string;
  packetSize?: string;
  loose?: string;
  extraPackets?: string;
  extraLoose?: string;
}

export type DistributionCell = string | number | LegacyDistributionCell | undefined;

function isLegacyDistributionCell(cell: DistributionCell): cell is LegacyDistributionCell {
  return typeof cell === "object" && cell !== null;
}

export function distributionCellForms(cell: DistributionCell): number {
  if (cell === undefined || cell === null) return 0;
  if (!isLegacyDistributionCell(cell)) return Number(cell) || 0;
  const packetSize = Number(cell.packetSize) || 25;
  const packets = (Number(cell.packets) || 0) + (Number(cell.extraPackets) || 0);
  const loose = (Number(cell.loose) || 0) + (Number(cell.extraLoose) || 0);
  return packets * packetSize + loose;
}

/* Reads one sub-field of a cell's breakdown for the edit form's
   individual inputs. A cell saved during the brief plain-number period
   isn't an object at all -- there's no way to know which of the 4
   sub-fields those forms should have come from, so it's surfaced as
   Loose Forms (the only sub-field with no multiplication involved,
   keeping the computed total exactly what it already was) with
   everything else starting blank, rather than guessed into Packets. */
export function distributionCellField(cell: DistributionCell, field: keyof LegacyDistributionCell): string {
  if (isLegacyDistributionCell(cell)) {
    const v = cell[field];
    if (v !== undefined && v !== "") return String(v);
    return field === "packetSize" ? "25" : "";
  }
  if (field === "packetSize") return "25";
  if (field === "loose") return cell !== undefined && cell !== null && cell !== "" ? String(cell) : "";
  return "";
}

export interface DistributionRow {
  id: string;
  school: string;
  enrolled?: string;
  /* Plain yes/no -- have this school's packets gone out this year?
     No other effect; not derived from anything else here. */
  distributed?: boolean;
  /* A plain classroom COUNT per type -- e.g. "this school has 17
     Regular classrooms" -- unrelated to breakdown's classroom-type x
     language FORMS grid below despite sharing the same three type
     names (Regular/Launch/CRR). */
  classroomRegular?: string;
  classroomLaunch?: string;
  classroomCrr?: string;
  consentPackets?: string;
  contactPerson?: string;
  remarks?: string;
  breakdown: Record<string, Record<string, DistributionCell>>;
}

export interface DistributionGroup {
  id: string;
  name: string;
  rows: DistributionRow[];
}

export function distributionRowTotalForms(row: DistributionRow): number {
  let total = 0;
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    for (const l of DISTRIBUTION_LANGUAGES) {
      total += distributionCellForms((row.breakdown[c.key] || {})[l.key]);
    }
  }
  return total;
}

export function distributionRowLanguageTotal(row: DistributionRow, langKey: string): number {
  let total = 0;
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    total += distributionCellForms((row.breakdown[c.key] || {})[langKey]);
  }
  return total;
}

/* Number of Consent Packets is no longer a manually-entered field --
   Michelle asked for it to always equal the sum of Packets + Extra
   Packets across every classroom-type x language cell (not Loose/
   Extra Loose, and not multiplied by packet size). A cell saved during
   this rewrite's brief plain-number period isn't an object and has no
   packets sub-field at all, so it contributes 0 here -- correct, since
   there's nothing to call a "packet" for that cell. */
export function distributionRowConsentPacketsTotal(row: DistributionRow): number {
  let total = 0;
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    for (const l of DISTRIBUTION_LANGUAGES) {
      const cell = (row.breakdown[c.key] || {})[l.key];
      if (cell && typeof cell === "object") {
        total += (Number(cell.packets) || 0) + (Number(cell.extraPackets) || 0);
      }
    }
  }
  return total;
}

/* ---------- Issues & Concerns ----------
   Simplified from the HTML app on purpose for correction/charting:
   fixed fields per type instead of its dynamic per-type "+Field" pool
   system. Software Issue's category/subcategory editor was simplified
   away too at first (a flat text category) but brought back as a real
   manageable Category -> Subcategory list, same pattern as Task
   Categories/Checklist template elsewhere in the app. One shared
   Issue shape covers all three remaining types; each type only ever
   reads/writes the fields relevant to it.

   A fourth type, "record_update", existed here too until Michelle
   asked to remove it entirely (including its existing records --
   see supabase/phase17_remove_record_update.sql). Its fields
   (studentName/dob/insuranceNumber/schoolYear/fileName/pageNumber/
   correctingCategory/correctInfo below, and the matching `issues`
   table columns) are left in place, just permanently unused now. */
export type IssueType = "software_issue" | "correction" | "charting";

/* A kind of issue the team added themselves (Issues & Concerns page), next to
   the three built-in types above. Issues of a custom type are stored with
   type "custom" plus the id of their custom type; they carry just a
   description and an optional note (remarks). */
export interface IssueCustomType {
  id: string;
  name: string;
}

export interface IssueSubcategory {
  id: string;
  name: string;
}

export interface IssueCategory {
  id: string;
  name: string;
  subcategories: IssueSubcategory[];
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  software_issue: "Software Issue",
  correction: "Review Patient Information",
  charting: "Charting Question",
};

export const ISSUE_STATUS_OPTIONS = ["Pending", "Resolved"];
export const CORRECTION_CATEGORIES = ["Name", "Date of Birth", "Insurance Number", "Grade", "School Year", "Other"];

// Recorded for a Software Issue's subcategory when its category has no
// subcategories to pick from (the Subcategory field is disabled in
// that case, so nothing real ever comes through) -- centralized here
// so every save site (app/(app)/issues/actions.ts's demo and real
// branches) uses the exact same value instead of each hardcoding its
// own "-" literal.
export const NO_SUBCATEGORY = "-";

export interface Issue {
  id: string;
  type: IssueType | "custom";
  /** Set when type is "custom": which of state.issueTypes this issue is filed under. */
  customTypeId?: string;
  reportedBy: string;
  status: string;
  createdAt: string;
  // Software issue
  description?: string;
  category?: string;
  subcategory?: string;
  remarks?: string; // "Note" in the UI
  // Record update -- unused now (removed type, see IssueType's comment).
  // studentName is the exception: revived below for Review Patient Information's "Name".
  dob?: string;
  insuranceNumber?: string;
  schoolYear?: string;
  fileName?: string;
  pageNumber?: string;
  correctingCategory?: string;
  correctInfo?: string;
  // Review Patient Information (was "Correction / Verification" -- Michelle
  // had it simplified down to a plain lookup-and-note form: which school
  // and record this is about, a link to it, and a note, instead of the old
  // Kind picker and per-field "needs correction" checkboxes) AND Charting
  // Questions (Michelle: same shape as Review Patient Information -- these
  // two types file into separate sections on the page but share this exact
  // set of fields; Charting no longer has its own distinct "question"
  // field, remarks/"Note" covers it now). reportedBy/status/comments above
  // and remarks below are shared with every other issue type already.
  school?: string;
  studentName?: string;
  studentRecordLink?: string;
  // Kind picker and "needs correction" checkboxes -- unused now (removed
  // per Michelle's "remove needs and type"), kept only so old rows don't
  // break anything reading them.
  correctionKind?: string;
  needsNameCorrection?: boolean;
  needsDobCorrection?: boolean;
  needsInsuranceCorrection?: boolean;
  needsOtherCorrection?: boolean;
  otherCorrectionDetail?: string;
  // Charting's own free-text question -- unused now (Charting uses the
  // shared school/studentName/studentRecordLink/remarks fields above
  // instead), kept only so old rows don't break anything reading them.
  question?: string;
  // Correction/Charting "Fix" -- fixedBy (the old sign-off chips) and
  // fixNote (the single free-text note that replaced them) are both
  // retired now that every issue type uses the comment thread below
  // instead; kept only so old rows don't break anything reading them.
  fixedBy?: string[];
  fixNote?: string;
  /** A comment thread, replacing the old single Note/Fix free-text
   *  field -- see components/issue-comments.tsx. Populated by
   *  lib/fetch-app-state.ts from the issue_comments table, grouped by
   *  issue id. */
  comments?: Comment[];
  /** VAs who have seen the LATEST comment -- reset to just the
   *  poster's own name whenever a new comment is added, so the
   *  blinking "new comment" dot reopens for everyone else. */
  commentAckBy?: string[];
}

/* Shared shape for every comment table in the app (issue_comments,
   general_note_comments, private_note_comments) -- all three are
   identical: who wrote it, the sanitized-HTML text (screenshots,
   links, @mentions all render the same way General/Private Notes'
   own bodies already do), when, and when last edited (undefined if
   never edited). */
export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  editedAt?: string;
}

export interface Mention {
  id: string;
  mentionedName: string;
  mentionerName: string;
  source: "issue_comment" | "general_note" | "priority_assignment" | "task_assignment";
  issueId?: string;
  noteId?: string;
  snippet: string;
  createdAt: string;
  readAt?: string;
}

export function canDeleteIssue(issue: Issue, currentName: string, currentIsAdmin: boolean): boolean {
  if (currentIsAdmin) return true;
  return issue.reportedBy === currentName;
}

// Same own-entry-or-admin rule as canDeleteIssue above -- a VA can
// remove their own EOD report (e.g. a duplicate/mis-entered one), an
// admin can remove anyone's.
export function canDeleteEodReport(report: EodReport, currentName: string, currentIsAdmin: boolean): boolean {
  if (currentIsAdmin) return true;
  return report.author === currentName;
}

/* ---------- EOD Reports: pure date/time helpers, same logic as the
   HTML app's computeEodTotalHours/fmtTime12/etc. — no server imports,
   safe to call from either a Server Action or a client component. */
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmtEodDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const mi = parseInt(parts[1], 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${MONTH_NAMES[mi]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
}

export function fmtMonthLabel(ym: string): string {
  const parts = String(ym || "").split("-");
  if (parts.length !== 2) return ym;
  const mi = parseInt(parts[1], 10) - 1;
  if (mi < 0 || mi > 11) return ym;
  return `${MONTH_NAMES[mi]} ${parts[0]}`;
}

export function parseHoursMinutesToMinutes(str?: string): number {
  if (!str) return 0;
  const parts = String(str).split(":");
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

export function fmtTime12(t?: string): string {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parseInt(parts[0], 10);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${parts[1]} ${ampm}`;
}

function timeStrToMinutes(str?: string): number | null {
  if (!str) return null;
  const parts = String(str).split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function formatMinutesAsHours(mins: number): string {
  if (mins == null || isNaN(mins) || mins < 0) return "";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}:${m < 10 ? "0" : ""}${m}`;
}

/* Auto-computes worked hours from Time in/out, minus a break (if both
   Break and Resume are filled in). Assumes a same-day shift — if Time
   out is earlier than Time in, treats it as crossing midnight. */
export function computeEodTotalHours(timeIn?: string, timeOut?: string, breakStart?: string, breakEnd?: string): string {
  const inM = timeStrToMinutes(timeIn);
  const outM = timeStrToMinutes(timeOut);
  if (inM == null || outM == null) return "";
  let worked = outM - inM;
  if (worked < 0) worked += 24 * 60;
  const bStart = timeStrToMinutes(breakStart);
  const bEnd = timeStrToMinutes(breakEnd);
  if (bStart != null && bEnd != null) {
    let breakMins = bEnd - bStart;
    if (breakMins < 0) breakMins += 24 * 60;
    worked -= breakMins;
  }
  if (worked < 0) worked = 0;
  return formatMinutesAsHours(worked);
}

export function findVaByEmail(state: AppState, email: string): Va | undefined {
  const lower = email.toLowerCase();
  return state.vas.find((v) => (v.email || "").toLowerCase() === lower);
}

/* Every VA gets an assigned color (Team page "VA Colors"); signatures
   everywhere (task sign-off, checklist auto-sign) use that same color
   so a name reads as "the same person" wherever it shows up. Falls
   back to undefined (caller uses a neutral default) for a name that
   isn't a current VA, or has no color set yet. */
export function vaColorByName(vas: Va[], name: string): string | undefined {
  return vas.find((v) => v.name === name)?.color || undefined;
}

/* Same rule as the HTML app's isSuperAdmin(): Michelle by name, or anyone
   flagged admin/owner. Not a database-enforced role — same app-level-only
   gating the HTML app has always used (the shared RLS policy already lets
   any allowlisted team member write app_state; this is about which UI
   actions are offered and re-checked, not a stricter DB permission). */
export const SUPERADMIN_NAME = "Michelle";
export function isAdmin(va: Va): boolean {
  if (va.name === SUPERADMIN_NAME) return true;
  return !!(va.admin || va.role === "owner");
}

/* Only the person who posted a suggestion, or the owner (Michelle), can
   delete it. */
export function canDeleteSuggestion(suggestion: Suggestion, currentName: string): boolean {
  return suggestion.author === currentName || currentName === SUPERADMIN_NAME;
}

/* Same rule as the HTML app's canDeleteNote for general-scope notes: the
   author can always delete their own; once they're off the team, only
   an admin can (not just anyone — General Notes are visible to the
   whole team, so this is a slightly higher bar than Suggestions). */
export function canDeleteGeneralNote(state: AppState, note: GeneralNote, currentName: string, currentIsAdmin: boolean): boolean {
  if (note.author === currentName) return true;
  const authorStillOnTeam = state.vas.some((v) => v.name === note.author);
  if (authorStillOnTeam) return false;
  return currentIsAdmin;
}

/* Same rule as the HTML app's canDeleteNote for private-scope notes:
   the author can always delete their own; once they're off the team,
   anyone who can see it (i.e. it was shared with them) can clean it
   up -- NOT anyone on the team, which is what this returned before
   the sharedWith check was added (a real bug: removing a VA now
   deletes their private notes outright, see removeVa in
   app/(app)/team/actions.ts, so this "author left" branch shouldn't
   normally trigger anymore, but it stays correct here as a safety net
   for any note that was already orphaned before that existed). */
export function canDeletePrivateNote(state: AppState, note: PrivateNote, currentName: string): boolean {
  if (note.author === currentName) return true;
  const authorStillOnTeam = state.vas.some((v) => v.name === note.author);
  if (authorStillOnTeam) return false;
  return (note.sharedWith || []).includes(currentName);
}

/* A private note is visible only to its author or anyone it's been
   explicitly shared with — never the whole team by default. */
export function visiblePrivateNotes(state: AppState, currentName: string): PrivateNote[] {
  return (state.privateNotes || []).filter(
    (n) => n.author === currentName || (n.sharedWith || []).includes(currentName)
  );
}

/* Same percentage the HTML app's Overview page shows: how much of the
   shared checklist template each school has marked "Done" for. */
export function checklistCompletion(state: AppState, schoolId: string): number {
  const tmpl = visibleSchoolItems(state.checklistTemplate || [], schoolId);
  const progress = Object.fromEntries(tmpl.map((item) => [item.id, state.checklistProgress[`${schoolId}:${item.id}`]]).filter((entry) => entry[1]));
  const summary = checklistSummary(tmpl, progress);
  return summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
}
