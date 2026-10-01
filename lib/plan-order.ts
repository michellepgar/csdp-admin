import type { GeneralTask, PlanItem, SchoolDataEntry } from "@/lib/app-state";

/* Task Priorities are shown in the order the admins set. Ordered ones
   (sortOrder set) come first, lowest number = highest priority; anything
   never ordered follows, oldest first. */
export function comparePriorities(a: PlanItem, b: PlanItem): number {
  const aOrder = a.sortOrder ?? Number.POSITIVE_INFINITY;
  const bOrder = b.sortOrder ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/* The ids in their new order after moving `id` one step up or down within
   `items` (already the unassigned priorities). Returns null when the move
   isn't possible (already first/last, or not in the list). */
export function movePriorityId(items: PlanItem[], id: string, direction: "up" | "down"): string[] | null {
  const ids = [...items].sort(comparePriorities).map((item) => item.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/* Your Plan's "Continue In Progress" section: planned tasks that were already
   started -- paused by Start my day, or still In Progress -- so picking up
   yesterday's work comes before starting anything new. */
export function continuingPlanItemIds(
  planItems: PlanItem[],
  schoolData: Record<string, SchoolDataEntry | undefined>,
  generalTasks: GeneralTask[],
): string[] {
  const started = (status: string | undefined) => status === "Paused" || status === "In Progress";
  return planItems
    .filter((item) => {
      if (item.kind !== "task") return false;
      if (item.taskFileCategoryId) {
        const files = (item.schoolId ? schoolData[item.schoolId]?.taskFiles : undefined) ?? [];
        return started(files.flatMap((f) => f.categories).find((c) => c.id === item.taskFileCategoryId)?.status);
      }
      return !!item.generalTaskId && started(generalTasks.find((t) => t.id === item.generalTaskId)?.status);
    })
    .map((item) => item.id);
}
