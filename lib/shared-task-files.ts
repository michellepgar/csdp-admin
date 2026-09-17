import type { Task, TaskCategory, TaskFile, School, SchoolDataEntry, GeneralTask, PlanItem } from "@/lib/app-state";

export type TaskFileActionResult = { error: string | null };

export async function submitTaskFileForm(
  action: (formData: FormData) => Promise<TaskFileActionResult>, formData: FormData,
  onError: (error: string | null) => void, onSuccess: () => void,
): Promise<void> {
  onError(null);
  try {
    const result = await action(formData);
    onError(result.error);
    if (!result.error) onSuccess();
  } catch {
    onError("The file could not be saved. Please refresh and try again.");
  }
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
  // 340px per task column -- wide enough for two SignatureChips (the
  // usual max: "we just usually have 2 VAs working on a file") side by
  // side in the VA/sign area alongside the fixed-width Status and
  // remove tracks (see SignAndStatus in components/tasks-card.tsx),
  // without wrapping to a second line the way the previous 240px did.
  const columnWidths = columns.map((column) => column.kind === "count" ? 72 : column.kind === "task" ? 340 : column.kind === "remove" ? 28 : undefined);
  return {columnWidths, minWidth: columnWidths.reduce<number>((total, width) => total + (width ?? 256), 0)};
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

function isToday(iso: string): boolean {
  return calendarDateInTeamZone(new Date(iso)) === calendarDateInTeamZone(new Date());
}

/* Same per-VA grouping Overview's old "Currently Working On" used, but
   each VA's list now also carries anything they completed today (status
   Completed or Review, per the new status_changed_at column) alongside
   what's still In Progress -- statusChangedAt is keyed by task id (school
   tasks) or general task id, matching Task.id/GeneralTask.id. */
export function todayActivityByVa(
  schools: School[],
  schoolData: Record<string, SchoolDataEntry>,
  generalTasks: GeneralTask[],
  statusChangedAt: Record<string, string>,
  planItems: PlanItem[] = [],
): Map<string, TodayActivityItem[]> {
  const byVa = new Map<string, TodayActivityItem[]>();
  const push = (vaName: string, item: TodayActivityItem) => {
    if (!byVa.has(vaName)) byVa.set(vaName, []);
    byVa.get(vaName)!.push(item);
  };

  for (const school of schools) {
    for (const task of schoolData[school.id]?.tasks || []) {
      const changedAt = statusChangedAt[task.id];
      const completedToday = (task.status === "Completed" || task.status === "Review") && !!changedAt && isToday(changedAt);
      if (task.status !== "In Progress" && !completedToday) continue;
      for (const vaName of task.vaAssigned) push(vaName, { schoolId: school.id, schoolName: school.name, category: task.category, fileName: task.fileName, status: task.status });
    }
  }

  for (const task of generalTasks) {
    const changedAt = statusChangedAt[task.id];
    const completedToday = (task.status === "Completed" || task.status === "Review") && !!changedAt && isToday(changedAt);
    if (task.status !== "In Progress" && !completedToday) continue;
    for (const vaName of task.vaAssigned) push(vaName, { schoolName: "General", category: task.category, fileName: task.description, status: task.status });
  }

  for (const item of planItems) {
    if (item.kind !== "note" || !item.completedAt || !item.vaName || !isToday(item.completedAt)) continue;
    push(item.vaName, { schoolName: "Reminder", category: "", fileName: item.label, status: "" });
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
