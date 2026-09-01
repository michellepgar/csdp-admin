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

export interface School {
  id: string;
  name: string;
}

export interface ChecklistProgressEntry {
  status: string;
}

export interface SchoolDataEntry {
  vaAssigned: string;
  /* Not modeled in full yet (Tasks/Email Tracker/Notes pages haven't
     been ported) — kept loosely typed here only so "Reset all tasks"
     (Backup & School Year) can clear them without corrupting whatever
     the HTML app already put there. */
  tasks?: unknown[];
  emailTracker?: unknown[];
  notes?: unknown[];
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

export interface AppState {
  schools: School[];
  vas: Va[];
  schoolData: Record<string, SchoolDataEntry>;
  checklistTemplate: { id: string }[];
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
  nurseLeader?: NurseLeader;
  eodReports?: EodReport[];
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
