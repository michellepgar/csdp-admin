import type { PlanItem, WorkNote } from "@/lib/app-state";

/* Work notes: a short explanation a VA attaches to their OWN task or
   reminder ("waiting on the school's reply", "couldn't finish -- the scan
   was blurry"). Notes never change the task/priority they sit on. Keyed by
   what the note is about (item key) plus who wrote it, so two VAs signed on
   the same task each keep their own note. */

export const MAX_WORK_NOTE = 300;

export const taskNoteKey = (taskFileCategoryId: string) => `t:${taskFileCategoryId}`;
export const generalNoteKey = (generalTaskId: string) => `g:${generalTaskId}`;
export const planNoteKey = (planItemId: string) => `p:${planItemId}`;

/* The key a plan item's note is filed under. A task item on your plan
   shares its note with the task itself -- so a note written in Currently
   Working On follows the task into Planned Work and Your Plan. A
   priority or reminder has no task behind it, so it's filed under its own
   id. */
export function planItemNoteKey(item: PlanItem): string {
  if (item.kind === "task") {
    if (item.taskFileCategoryId) return taskNoteKey(item.taskFileCategoryId);
    if (item.generalTaskId) return generalNoteKey(item.generalTaskId);
  }
  return planNoteKey(item.id);
}

export type ParsedNoteKey = { type: "task" | "general" | "plan"; id: string };

export function parseNoteKey(key: string): ParsedNoteKey | null {
  const separator = key.indexOf(":");
  if (separator < 1) return null;
  const tag = key.slice(0, separator);
  const id = key.slice(separator + 1);
  if (!id) return null;
  if (tag === "t") return { type: "task", id };
  if (tag === "g") return { type: "general", id };
  if (tag === "p") return { type: "plan", id };
  return null;
}

/* A fast (item, person) -> note text lookup over the fetched notes. */
export function makeNoteLookup(notes: WorkNote[] | undefined): (itemKey: string | undefined, vaName: string) => string | undefined {
  const byKey = new Map((notes || []).map((n) => [`${n.itemKey}|${n.vaName}`, n.note]));
  return (itemKey, vaName) => (itemKey ? byKey.get(`${itemKey}|${vaName}`) : undefined);
}
