import type { PlanItem } from "@/lib/app-state";

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
