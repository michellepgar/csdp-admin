/* Deliberately no imports of anything server-only (next/headers,
   @/lib/supabase/server) here — this file is imported by client
   components too (for shared types/constants like CONTACT_FIELDS), and
   pulling in a server-only module would drag it into the client bundle,
   which Next.js's build correctly refuses to do. fetchAppState() itself
   lives in lib/fetch-app-state.ts instead, kept server-only. */

export interface Va {
  id: string;
  name: string;
  email?: string;
  admin?: boolean;
  role?: string;
  color?: string;
}

export const SCHOOL_GROUPS = ["Pre-K", "Elementary School", "Middle School", "High School"];
export const CONTACT_POSITIONS = ["Principal", "Assistant Principal", "Front Desk", "Nurse"];

export interface School {
  id: string;
  name: string;
  website?: string;
  hours?: string;
  /* Some schools don't need a second pass after Initial -- clicking
     "No Recheck" on the school page sets this so Recheck's section
     shows as disabled/grayed-out there, instead of tracking files that
     will never apply to this school. */
  noRecheck?: boolean;
}

export interface SchoolContact {
  id: string;
  position: string;
  email: string;
  createdAt: string;
}

export interface ChecklistProgressEntry {
  status: string;
  /* Name of whoever last checked this off -- shown as a small signature
     next to the item. Anyone on the team can check a checklist item off
     (not just the assigned VA), so this records who actually did it. */
  checkedBy?: string;
}

export interface TaskCategory {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  category: string;
  fileName: string;
  count?: string;
  status: string;
  vaAssigned: string[];
  createdAt: string;
  /* Initial/Recheck files often need a separate "we reached out about
     this record" trail, tracked against the SAME file name rather than
     as a second task row -- its own status/signatures, independent of
     the main status/vaAssigned above. Unused (undefined) for every
     other category. */
  commsStatus?: string;
  commsVaAssigned?: string[];
}

/* Categories where a task also gets its own parallel Communications
   status+signatures, shown alongside the main one on the same row. */
export const CATEGORIES_WITH_COMMUNICATIONS = ["Initial", "Recheck"];

export interface EmailTrackerItem {
  id: string;
  description: string;
  status: string;
  addedBy: string;
  createdAt: string;
}

export const TASK_STATUS_OPTIONS = ["", "In Progress", "Paused", "Completed"];
export const EMAIL_STATUS_OPTIONS = ["Needs My Response", "Waiting on Them", "Done"];
export const COUNT_CATEGORIES = ["Encoding & Uploading (Consent & SDF)", "Initial", "Recheck"];

export interface SchoolDataEntry {
  vaAssigned: string;
  tasks?: Task[];
  emailTracker?: EmailTrackerItem[];
  /* School Notes not ported yet — kept loose so "Reset all tasks"
     (Backup & School Year) can clear tasks/checklist without touching
     or corrupting whatever the HTML app already put here. */
  notes?: unknown[];
}

/* Same rule the HTML app uses for both the Yearly Checklist and Email
   Tracker/Tasks delete permissions: the VA actually assigned to this
   school, or an admin/owner as a safety net. */
export function canEditSchoolRecords(sd: SchoolDataEntry | undefined, currentName: string, currentIsAdmin: boolean): boolean {
  if (currentIsAdmin) return true;
  return !!(sd && sd.vaAssigned && sd.vaAssigned === currentName);
}

export interface Suggestion {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  status: "Requested" | "Working On It" | "Added";
}

export interface GeneralNote {
  id: string;
  text: string;
  author: string;
  urgency?: "Urgent" | "";
  ackBy?: string[];
  createdAt: string;
}

export interface PrivateNote {
  id: string;
  text: string;
  author: string;
  sharedWith?: string[];
  ackBy?: string[];
  createdAt: string;
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

export interface ChecklistTemplateItem {
  id: string;
  description: string;
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
  accessRequests?: AccessRequest[];
  issues?: Issue[];
  distributionGroups?: DistributionGroup[];
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

// A cell is normally a plain "forms" string/number in this simplified
// version. Data carried over from the original HTML app stores each cell
// as an object instead ({ packets, packetSize, loose, extraPackets,
// extraLoose }, with automatic packet-size math) — read those too so
// existing production data doesn't crash the page, and surface them as
// a single computed forms count.
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

// Display value for an editable cell input: legacy object cells show
// their computed forms count (editing one replaces the packet breakdown
// with a plain number going forward — a deliberate simplification).
export function distributionCellDisplay(cell: DistributionCell): string {
  if (cell === undefined || cell === null) return "";
  if (!isLegacyDistributionCell(cell)) return String(cell);
  const forms = distributionCellForms(cell);
  return forms ? String(forms) : "";
}

export interface DistributionRow {
  id: string;
  school: string;
  enrolled?: string;
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

/* ---------- Issues & Concerns ----------
   Simplified from the HTML app on purpose: fixed fields per type instead
   of its dynamic per-type "+Field" pool system, and a flat category
   (just a text value) for Software Issue instead of its nested
   category/subcategory editor. One shared shape covers all four types;
   each type only ever reads/writes the fields relevant to it. */
export type IssueType = "software_issue" | "record_update" | "correction" | "charting";

export const ISSUE_STATUS_OPTIONS = ["Pending", "Resolved"];
export const CORRECTION_CATEGORIES = ["Name", "Date of Birth", "Insurance Number", "Grade", "School Year", "Other"];
export const CORRECTION_KINDS = ["Correction", "Verification"];

export interface Issue {
  id: string;
  type: IssueType;
  reportedBy: string;
  status: string;
  createdAt: string;
  // Software issue
  description?: string;
  category?: string;
  remarks?: string;
  // Record update
  studentName?: string;
  dob?: string;
  insuranceNumber?: string;
  schoolYear?: string;
  fileName?: string;
  pageNumber?: string;
  correctingCategory?: string;
  correctInfo?: string;
  // Correction / Verification
  correctionKind?: string;
  studentRecordLink?: string;
  needsNameCorrection?: boolean;
  needsDobCorrection?: boolean;
  needsInsuranceCorrection?: boolean;
  needsOtherCorrection?: boolean;
  otherCorrectionDetail?: string;
  // Charting Questions
  question?: string;
  // Correction/Charting "Fix" — multiple independent signatures, same
  // pattern as a Task's vaAssigned, not one shared "fixed by" field.
  fixedBy?: string[];
}

export function canDeleteIssue(issue: Issue, currentName: string, currentIsAdmin: boolean): boolean {
  if (currentIsAdmin) return true;
  return issue.reportedBy === currentName;
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

/* Same rule as the HTML app's canDeleteNote: the author can always
   delete their own suggestion; once they're no longer on the team,
   anyone can clean it up (there's otherwise no way to ever remove it). */
export function canDeleteSuggestion(state: AppState, suggestion: Suggestion, currentName: string): boolean {
  if (suggestion.author === currentName) return true;
  const authorStillOnTeam = state.vas.some((v) => v.name === suggestion.author);
  return !authorStillOnTeam;
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
   anyone who can see it (i.e. it was shared with them) can clean it up. */
export function canDeletePrivateNote(state: AppState, note: PrivateNote, currentName: string): boolean {
  if (note.author === currentName) return true;
  const authorStillOnTeam = state.vas.some((v) => v.name === note.author);
  return !authorStillOnTeam;
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
  const tmpl = state.checklistTemplate || [];
  if (!tmpl.length) return 0;
  let done = 0;
  for (const item of tmpl) {
    const entry = state.checklistProgress[`${schoolId}:${item.id}`];
    if (entry && entry.status === "Done") done++;
  }
  return Math.round((done / tmpl.length) * 100);
}
