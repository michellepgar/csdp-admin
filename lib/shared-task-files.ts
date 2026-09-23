import type { Task, TaskCategory, TaskFile, School, SchoolDataEntry, GeneralTask, PlanItem } from "@/lib/app-state";

/* `warning` is set on an otherwise-successful result to flag something worth
   knowing without stopping the save -- currently just addTask's duplicate
   file name notice (see duplicateFileNameInTable below). */
export type TaskFileActionResult = { error: string | null; warning?: string };

export async function submitTaskFileForm(
  action: (formData: FormData) => Promise<TaskFileActionResult>, formData: FormData,
  onError: (error: string | null) => void, onSuccess: () => void,
  onWarning?: (warning: string | null) => void,
): Promise<void> {
  onError(null);
  onWarning?.(null);
  try {
    const result = await action(formData);
    onError(result.error);
    if (!result.error) {
      onWarning?.(result.warning ?? null);
      onSuccess();
    }
  } catch {
    onError("The file could not be saved. Please refresh and try again.");
  }
}

/* One existing file, boiled down to what duplicateFileNameInTable needs --
   shared by addTask's demo branch (from full TaskFile records) and its real
   branch (from a lightweight column-only query), so both go through the
   exact same matching rule. */
export type FileTableRef = { fileName: string; tableId?: string; categoryIds: string[] };

/* Whether `name` already names a file in the exact same table that
   tableId/categoryIds describes -- matching is by trimmed name, case-
   insensitive, and "same table" uses the identical rule groupTaskTables
   uses to group files in the first place (a saved table_id, else the same
   set of category ids). A file name is a label, not an identity (see
   supabase/phase40_unrestricted_file_names.sql), so this only warns --
   Michelle asked to be told, not stopped, when a new file repeats one
   that's already in the same table. */
export function duplicateFileNameInTable(existing: FileTableRef[], tableId: string, categoryIds: string[], name: string): boolean {
  const trimmedName = name.trim().toLowerCase();
  if (!trimmedName) return false;
  // Same "what table is this really" key groupTaskTables itself groups by: a
  // saved table_id if there is one, else the sorted set of category ids --
  // computed the same way for the incoming file and each existing one, so a
  // sibling that hasn't (yet) had a table_id written to it (see addTask's own
  // comment on when that happens) still counts as the same table. Comparing
  // raw tableId strings instead would miss exactly that case: confirmed
  // directly, adding a second file through a table's own "Add file" row
  // showed no warning because only the NEW row gets table_id written to it.
  const key = tableId || JSON.stringify([...new Set(categoryIds)].sort());
  return existing.some((file) => {
    if (file.fileName.trim().toLowerCase() !== trimmedName) return false;
    const fileKey = file.tableId || JSON.stringify([...new Set(file.categoryIds)].sort());
    return fileKey === key;
  });
}

/* Every file name (trimmed, case-insensitive) that appears more than once
   within one table -- computed straight from the same data every render, so
   it never goes stale and never depends on catching a one-off message before
   the next server revalidate replaces it (confirmed directly: a transient
   "just added a duplicate" toast next to the add-file row got wiped by the
   revalidate that same successful add triggers, often before it could be
   read). Used to flag every duplicate a table has, not just ones created
   going forward. */
export function duplicateFileNamesInTable(files: { fileName: string }[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const file of files) {
    const name = file.fileName.trim().toLowerCase();
    if (!name) continue;
    if (seen.has(name)) dupes.add(name);
    else seen.add(name);
  }
  return dupes;
}

export function taskTableColumns(categories: TaskCategory[]): (
  {kind: "file"} | {kind: "remove"} | {kind: "count"; categories: TaskCategory[]} | {kind: "task"; category: TaskCategory}
)[] {
  return [
    {kind: "count", categories: categories.filter((category) => category.hasCount)},
    {kind: "file"},
    ...categories.map((category) => ({kind: "task" as const, category})),
    {kind: "remove"},
  ];
}

export function taskTableLayout(columns: ReturnType<typeof taskTableColumns>): {
  columnWidths: (number | undefined)[]; minWidth: number;
} {
  // Only Count and the remove button have a fixed width. The file name and
  // every task column share whatever room the screen gives them (the table
  // is table-fixed and w-full), so a wide screen fills the card and a narrow
  // one only scrolls sideways below minWidth. A file has one VA now, so a task
  // column just needs room for one signature chip, the sign/take-over button,
  // Status and the 3-dot menu (SignAndStatus wraps if it gets tighter).
  const columnWidths = columns.map((column) => column.kind === "count" ? 64 : column.kind === "remove" ? 28 : undefined);
  const minimum = (column: (typeof columns)[number], width: number | undefined) => width ?? (column.kind === "task" ? 250 : 180);
  return {columnWidths, minWidth: columns.reduce<number>((total, column, index) => total + minimum(column, columnWidths[index]), 0)};
}

// Only return safe, actionable messages; raw database errors stay on the server.
export async function saveTaskFile(operation: () => Promise<void>): Promise<TaskFileActionResult> {
  try {
    await operation();
    return { error: null };
  } catch (error) {
    console.error("Task file save failed", error);
    return { error: "The file could not be saved. Please try again." };
  }
}

export function normalizeSelectedCategoryIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function selectedCategoryFiles(files: TaskFile[], selectedIds: string[], categoryId: string): TaskFile[] {
  const ids = new Set(normalizeSelectedCategoryIds(selectedIds));
  if ([...ids].some((id) => !files.some((file) => file.id === id))) throw new Error("File selection has changed. Please try again.");
  return files.filter((file) => ids.has(file.id) && !file.categories.some((assignment) => assignment.categoryId === categoryId));
}

export function visibleTaskCategories(categories: TaskCategory[], files: TaskFile[]): TaskCategory[] {
  const used = new Set(files.flatMap((file) => file.categories.map((assignment) => assignment.categoryId)));
  return categories.filter((category) => used.has(category.id));
}

export function groupTaskTables(categories: TaskCategory[], files: TaskFile[]): {
  key: string; categories: TaskCategory[]; files: TaskFile[];
}[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  for (const file of files) for (const assignment of file.categories) {
    if (!categoryById.has(assignment.categoryId)) categoryById.set(assignment.categoryId, { id: assignment.categoryId, name: assignment.category });
  }
  const categoryOrder = new Map([...categoryById.keys()].map((id, index) => [id, index]));
  const groups = new Map<string, { key: string; categories: TaskCategory[]; files: TaskFile[] }>();
  for (const file of files) {
    const ids = [...new Set(file.categories.map((assignment) => assignment.categoryId))];
    if (ids.length === 0) continue;
    const key = file.tableId || JSON.stringify([...ids].sort());
    let group = groups.get(key);
    if (!group) {
      ids.sort((a, b) => categoryOrder.get(a)! - categoryOrder.get(b)!);
      group = { key, categories: ids.map((id) => categoryById.get(id)!), files: [] };
      groups.set(key, group);
    }
    group.files.push(file);
    for (const id of ids) if (!group.categories.some((category) => category.id === id)) group.categories.push(categoryById.get(id)!);
  }
  for (const group of groups.values()) if (group.files.some((file) => !!file.tableId)) {
    const positions = new Map<string, number>();
    for (const file of group.files) for (const assignment of file.categories) positions.set(assignment.categoryId, Math.min(positions.get(assignment.categoryId) ?? Infinity, assignment.sortOrder));
    group.categories.sort((a,b) => positions.get(a.id)! - positions.get(b.id)! || categoryOrder.get(a.id)! - categoryOrder.get(b.id)!);
  }
  return [...groups.values()].sort((a, b) => {
    for (let i = 0; i < Math.min(a.categories.length, b.categories.length); i++) {
      const difference = categoryOrder.get(a.categories[i].id)! - categoryOrder.get(b.categories[i].id)!;
      if (difference) return difference;
    }
    return a.categories.length - b.categories.length;
  });
}

export function legacyTasksToTaskFiles(tasks: Task[], categories: TaskCategory[]): TaskFile[] {
  const categoryByName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category.id]));
  const byName = new Map<string, TaskFile>();
  for (const task of [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = task.fileName.trim().toLowerCase();
    let file = byName.get(key);
    if (!file) {
      file = { id: `legacy-file-${task.id}`, fileName: task.fileName, sortOrder: task.sortOrder, createdAt: task.createdAt, categories: [] };
      byName.set(key, file);
    }
    file.categories.push({
      id: task.id,
      createdAt: task.createdAt,
      taskFileId: file.id,
      categoryId: categoryByName.get(task.category.trim().toLowerCase()) || `legacy-category-${task.category.trim().toLowerCase()}`,
      category: task.category,
      status: task.status,
      vaAssigned: task.vaAssigned,
      sortOrder: task.sortOrder,
      count: task.count,
      commsStatus: task.commsStatus,
      commsVaAssigned: task.commsVaAssigned,
    });
  }
  return Array.from(byName.values());
}

export interface TodayActivityItem {
  schoolId?: string;
  schoolName: string;
  category: string;
  fileName: string;
  /** The task/general task's own real status ("In Progress", "Completed",
   *  "Review") -- shown as a status badge on Overview's Today card
   *  instead of the old plain "(completed today)" text. Empty for a
   *  Reminder item (private-note reminders have no workflow status of
   *  their own), which the caller renders without a badge. */
  status: string;
  /** Appended to the school link href for this item -- e.g.
   *  "#email-tracker" so an email item's Today entry jumps straight to
   *  that section instead of just the top of the school page. Absent
   *  for every other kind of Today item. */
  linkSuffix?: string;
  /** What a work note on this item is filed under (lib/work-notes.ts). Absent for email items, which take no notes. */
  itemKey?: string;
}

export interface OpenEmailItem {
  schoolId: string;
  schoolName: string;
  itemId: string;
  description: string;
  status: string;
}

/* Email Tracker items aren't assigned to an individual VA the way
   tasks are -- only the whole school is (schoolData[id].vaAssigned) --
   so "whose plan is this on" is just that school's one assigned VA.
   Unlike tasks/priorities, this is never opt-in: every open (non-Done)
   email for a VA's schools always shows on Today, Plans for Tomorrow,
   and Your Plan until its status changes to Done -- Michelle asked for
   this specifically as a standing reminder to check email, not
   something that needs claiming or starting first. Shared here since
   all three surfaces need the identical derivation. */
export function openEmailItemsByVa(schools: School[], schoolData: Record<string, SchoolDataEntry>): Map<string, OpenEmailItem[]> {
  const byVa = new Map<string, OpenEmailItem[]>();
  for (const school of schools) {
    const va = schoolData[school.id]?.vaAssigned;
    if (!va) continue;
    for (const item of schoolData[school.id]?.emailTracker || []) {
      if (item.status === "Done") continue;
      if (!byVa.has(va)) byVa.set(va, []);
      byVa.get(va)!.push({ schoolId: school.id, schoolName: school.name, itemId: item.id, description: item.description, status: item.status });
    }
  }
  return byVa;
}

/* This runs server-side (Vercel functions default to UTC), so
   comparing calendar dates with the server's own local getters would
   put the day boundary at UTC midnight instead of the team's actual
   midnight -- something finished late in the evening Eastern time
   could already read as "tomorrow" in UTC, or something from
   yesterday evening Eastern could still read as "today" in UTC's
   early morning. The whole team works Eastern, so pin the comparison
   to that zone explicitly instead of relying on the server's own. */
const TEAM_TIME_ZONE = "America/New_York";

function calendarDateInTeamZone(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function isToday(iso: string): boolean {
  return calendarDateInTeamZone(new Date(iso)) === calendarDateInTeamZone(new Date());
}

/* Same per-VA grouping Overview's old "Currently Working On" used, but
   each VA's list now also carries anything they completed today (status
   Completed or Review, per the new status_changed_at column) alongside
   what's still In Progress -- statusChangedAt is keyed by task id (school
   tasks) or general task id, matching Task.id/GeneralTask.id.

   "Today" for a VA who has clicked Start my day means SINCE that click
   (shiftStartByVa): anything completed before it is yesterday's work and is
   cleared, even if it happened earlier on the same calendar date. A VA with
   no open shift falls back to the calendar date. */
export function todayActivityByVa(
  schools: School[],
  schoolData: Record<string, SchoolDataEntry>,
  generalTasks: GeneralTask[],
  statusChangedAt: Record<string, string>,
  planItems: PlanItem[] = [],
  shiftStartByVa: Record<string, string> = {},
): Map<string, TodayActivityItem[]> {
  const byVa = new Map<string, TodayActivityItem[]>();
  const isRecentFor = (iso: string | undefined, vaName: string): boolean => {
    if (!iso) return false;
    const start = shiftStartByVa[vaName];
    return start ? new Date(iso).getTime() >= new Date(start).getTime() : isToday(iso);
  };
  const push = (vaName: string, item: TodayActivityItem) => {
    if (!byVa.has(vaName)) byVa.set(vaName, []);
    byVa.get(vaName)!.push(item);
  };

  for (const school of schools) {
    for (const task of schoolData[school.id]?.tasks || []) {
      const changedAt = statusChangedAt[task.id];
      const done = task.status === "Completed" || task.status === "Review";
      if (task.status !== "In Progress" && !done) continue;
      for (const vaName of task.vaAssigned) {
        if (task.status !== "In Progress" && !isRecentFor(changedAt, vaName)) continue;
        push(vaName, { schoolId: school.id, schoolName: school.name, category: task.category, fileName: task.fileName, status: task.status, itemKey: `t:${task.id}` });
      }
    }
  }

  for (const task of generalTasks) {
    const changedAt = statusChangedAt[task.id];
    const done = task.status === "Completed" || task.status === "Review";
    if (task.status !== "In Progress" && !done) continue;
    for (const vaName of task.vaAssigned) {
      if (task.status !== "In Progress" && !isRecentFor(changedAt, vaName)) continue;
      push(vaName, { schoolName: "General", category: task.category, fileName: task.description, status: task.status, itemKey: `g:${task.id}` });
    }
  }

  for (const item of planItems) {
    if (item.kind === "task" || !item.vaName) continue;
    if (item.completedAt) {
      if (!isRecentFor(item.completedAt, item.vaName)) continue;
      // A checked reminder is DONE: it shows here only as reviewed (a check
      // mark), and is never carried into Planned Work.
      push(item.vaName, { schoolName: "Reminder", category: "", fileName: item.label, status: "Reviewed", itemKey: `p:${item.id}` });
    } else if (item.startedAt) {
      // Started but not done yet -- shown regardless of date, same as an
      // In Progress task (a reminder has no task row of its own to flip
      // to In Progress, so this plan_item is the only record of it).
      push(item.vaName, { schoolName: "Reminder", category: "", fileName: item.label, status: "In Progress", itemKey: `p:${item.id}` });
    }
  }

  // An email item marked Done today shows as completed (its school's VA gets it),
  // the same way a finished task or a reviewed reminder does.
  for (const school of schools) {
    const vaName = schoolData[school.id]?.vaAssigned;
    if (!vaName) continue;
    for (const item of schoolData[school.id]?.emailTracker || []) {
      if (item.status !== "Done" || !isRecentFor(item.doneAt, vaName)) continue;
      push(vaName, { schoolId: school.id, schoolName: school.name, category: "Email", fileName: item.description, status: "Done", linkSuffix: "#email-tracker" });
    }
  }

  for (const [vaName, items] of openEmailItemsByVa(schools, schoolData)) {
    for (const item of items) push(vaName, { schoolId: item.schoolId, schoolName: item.schoolName, category: "Email", fileName: item.description, status: item.status, linkSuffix: "#email-tracker" });
  }

  return byVa;
}

/* Used by "Save Plan" (app/(app)/overview/actions.ts) to turn a VA's
   freshly-checked set of ids into the minimal set of plan_items writes:
   rows to insert for newly-checked ids, and existing rows to delete for
   ids that got unchecked. Generic over refId so the same helper covers
   both task_file_category_id and general_task_id -- the caller maps
   whichever one a plan_items row actually has into `refId` first. */
export function diffPlanSelection(
  existing: { id: string; refId?: string }[],
  checkedIds: string[],
): { toInsert: string[]; toDeleteIds: string[] } {
  const existingIds = new Set(existing.map((row) => row.refId).filter(Boolean));
  const checkedSet = new Set(checkedIds);
  return {
    toInsert: checkedIds.filter((id) => !existingIds.has(id)),
    toDeleteIds: existing.filter((row) => row.refId && !checkedSet.has(row.refId)).map((row) => row.id),
  };
}
