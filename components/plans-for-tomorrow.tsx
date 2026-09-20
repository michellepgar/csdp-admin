"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CategoryColumns, type CategoryColumn } from "@/components/category-columns";
import { StatusBadge } from "@/components/status-badge";
import { Dropdown } from "@/components/dropdown";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { WorkNoteButton } from "@/components/work-note-button";
import { makeNoteLookup, planItemNoteKey } from "@/lib/work-notes";
import { openEmailItemsByVa } from "@/lib/shared-task-files";
import { vaColorByName, type GeneralTask, type PlanItem, type School, type SchoolDataEntry, type TaskCategory, type Va, type WorkNote } from "@/lib/app-state";

/* Same status/tone pairing as email-tracker-card.tsx's own copy --
   kept separate rather than a shared import for the same reason
   overview/page.tsx's TODAY_STATUS_TONE is its own copy: neither file
   exports theirs, and this is read-only display. */
const EMAIL_STATUS_TONE = { "Needs My Response": "warning", "Waiting on Them": "paused" } as const;

/* A kind:"task" PlanItem only carries a pre-built display label (e.g.
   "Q3-enrollment-report.xlsx — Initial") -- no separate category
   field of its own. Rather than parse that string back apart, look
   the real task/general-task row back up by the id the plan item
   already carries (taskFileCategoryId+schoolId, or generalTaskId) --
   the exact same data Overview's Today card and the Your Plan bubble
   already have in scope, just with a real .category/.fileName on it.
   Falls back to the raw label under an "Other" column on the rare
   chance the underlying row was deleted out from under a stale plan
   item, rather than throwing. */
function resolveTaskItem(item: PlanItem, schools: School[], schoolData: Record<string, SchoolDataEntry>, generalTasks: GeneralTask[]) {
  if (item.taskFileCategoryId && item.schoolId) {
    const task = schoolData[item.schoolId]?.tasks?.find((t) => t.id === item.taskFileCategoryId);
    if (task) {
      return { category: task.category, fileName: task.fileName, schoolName: schools.find((s) => s.id === item.schoolId)?.name, href: `/schools/${item.schoolId}` };
    }
  } else if (item.generalTaskId) {
    const task = generalTasks.find((t) => t.id === item.generalTaskId);
    if (task) return { category: task.category, fileName: task.description, schoolName: "General", href: "/general-tasks" };
  }
  return { category: "Other", fileName: item.label, schoolName: undefined, href: undefined };
}

/* Every VA's own plan for tomorrow -- both their own carried-over
   tasks (kind:"task") and any priority assigned to them by name
   (kind:"priority" with vaName set), grouped by VA. Unassigned/shared
   priorities are NOT shown here -- those live only in the Task
   Priorities widget beside Alerts, until a VA claims one (at which
   point it gets a vaName and shows up here). kind:"note" reminders are
   excluded entirely -- those are personal Your-Plan-bubble items, not
   part of the shared tomorrow plan. A completedAt item is also
   excluded regardless of kind -- a priority resolved as "just a
   reminder" (resolvePriorityPlanItem's reminder branch) stays kind:
   "priority" but is done, and has no business showing up here as if
   still pending. The ✕ only renders on the current VA's own items --
   removePlanItem enforces the same ownership check server-side, but
   showing it on someone else's row would just be a button that always
   fails, so it's hidden here too.

   Tasks and open Email Tracker items are arranged into category
   columns (one column per category, files listed below, status beside
   each file) -- the VAs asked for the same layout tasks-card.tsx's own
   school tables already use, instead of one flat mixed list. A
   priority joins this same layout: one linked to a real school+
   category (via "Link to a task") lands in that real category's
   column, marked with the same priority dot Task Priorities and Your
   Plan already use, so it still reads as a priority sitting among
   ordinary tasks. A genuinely free-text priority has no real category
   to join, so it gets its own dedicated "Priorities" column instead. */
export function PlansForTomorrow({ planItems, vas, schools, schoolData, generalTasks, taskCategories, workNotes, currentUserName, addPlan, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  generalTasks: GeneralTask[];
  taskCategories: TaskCategory[];
  workNotes: WorkNote[];
  currentUserName: string;
  /** The "Add" button (an ReactNode so this list stays a plain display component). */
  addPlan?: React.ReactNode;
  removePlanItem: (formData: FormData) => void;
}) {
  const noteLookup = makeNoteLookup(workNotes);
  const [vaFilter, setVaFilter] = useState("");
  const [viewMode, setViewMode] = useState<"columns" | "list">("columns");

  const byVa = new Map<string, PlanItem[]>();
  for (const item of planItems) {
    if (!item.vaName || item.kind === "note" || item.completedAt) continue;
    if (!byVa.has(item.vaName)) byVa.set(item.vaName, []);
    byVa.get(item.vaName)!.push(item);
  }
  const emailByVa = openEmailItemsByVa(schools, schoolData);
  // Someone removed from the team no longer appears here -- their plan
  // items and open emails stay in the data (and the tasks they signed
  // stay on the school pages), this just hides the ex-teammate's row.
  const currentVaNames = new Set(vas.map((v) => v.name));
  const allVaNames = Array.from(new Set([...byVa.keys(), ...emailByVa.keys()]))
    .filter((name) => currentVaNames.has(name))
    .sort((a, b) => a.localeCompare(b));
  const vaNames = allVaNames.filter((name) => !vaFilter || name === vaFilter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Planned Work</h2>
        <div className="flex flex-wrap items-center gap-2">
        {addPlan}
        {allVaNames.length > 0 && (
          <>
            <Dropdown
              name="vaFilter"
              value={vaFilter}
              onChange={setVaFilter}
              placeholder="All VAs"
              options={[{ value: "", label: "All VAs" }, ...allVaNames.map((name) => ({ value: name, label: name }))]}
              className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
            />
            <SegmentedToggle value={viewMode} onChange={setViewMode} options={[{ value: "columns", label: "Columns" }, { value: "list", label: "List" }]} />
          </>
        )}
        </div>
      </div>
      {vaNames.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned yet.</p>}
      <div className="space-y-3">
        {vaNames.map((vaName) => {
          const items = byVa.get(vaName) || [];
          const priorities = items.filter((item) => item.kind === "priority");
          const tasks = items.filter((item) => item.kind === "task");
          const emails = emailByVa.get(vaName) || [];

          const byCategory = new Map<string, CategoryColumn["rows"]>();
          const addRow = (category: string, row: CategoryColumn["rows"][number]) => {
            if (!byCategory.has(category)) byCategory.set(category, []);
            byCategory.get(category)!.push(row);
          };
          for (const item of tasks) {
            const resolved = resolveTaskItem(item, schools, schoolData, generalTasks);
            addRow(resolved.category, {
              key: item.id,
              label: resolved.fileName,
              sublabel: resolved.schoolName,
              href: resolved.href,
              note: noteLookup(planItemNoteKey(item), vaName),
              action: vaName === currentUserName ? (
                <>
                  <WorkNoteButton itemKey={planItemNoteKey(item)} note={noteLookup(planItemNoteKey(item), vaName)} label={resolved.fileName} />
                  <form action={removePlanItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmDeleteButton confirmMessage={`Remove "${resolved.fileName}" from your plan?`} pendingLabel="…" iconSize="icon-2xs">✕</ConfirmDeleteButton>
                  </form>
                </>
              ) : undefined,
            });
          }
          for (const item of priorities) {
            const category = item.suggestedCategoryId ? taskCategories.find((c) => c.id === item.suggestedCategoryId)?.name : undefined;
            addRow(category || "Priorities", {
              key: item.id,
              label: item.suggestedFileName || item.label,
              sublabel: item.suggestedSchoolId ? schools.find((s) => s.id === item.suggestedSchoolId)?.name : undefined,
              href: item.suggestedSchoolId ? `/schools/${item.suggestedSchoolId}` : undefined,
              dot: true,
              note: noteLookup(planItemNoteKey(item), vaName),
              action: vaName === currentUserName ? (
                <>
                  <WorkNoteButton itemKey={planItemNoteKey(item)} note={noteLookup(planItemNoteKey(item), vaName)} label={item.label} />
                  <form action={removePlanItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmDeleteButton confirmMessage={`Remove "${item.label}" from your plan? It'll go back to Task Priorities for anyone to claim.`} pendingLabel="…" iconSize="icon-2xs">✕</ConfirmDeleteButton>
                  </form>
                </>
              ) : undefined,
            });
          }
          for (const item of emails) {
            addRow("Email", {
              key: item.itemId,
              label: item.description,
              sublabel: item.schoolName,
              href: `/schools/${item.schoolId}#email-tracker`,
              status: item.status,
              statusTone: EMAIL_STATUS_TONE[item.status as keyof typeof EMAIL_STATUS_TONE] ?? "neutral",
            });
          }
          const columns: CategoryColumn[] = Array.from(byCategory.entries()).map(([category, rows]) => ({ category, rows }));
          const flatRows = columns.flatMap((c) => c.rows);

          const vaColor = vaColorByName(vas, vaName);
          return (
            <div key={vaName} className="flex overflow-hidden rounded-md border bg-record-background no-record-hover">
              <div className="flex w-9 shrink-0 items-center justify-center border-r py-3" style={{ color: vaColor }}>
                <span className="whitespace-nowrap text-sm font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{vaName}</span>
              </div>
              {viewMode === "list" ? (
                <ul className="min-w-0 flex-1 space-y-1.5 p-3">
                  {flatRows.map((row) => (
                    <li key={row.key} className="flex flex-wrap items-center justify-between gap-1.5 text-sm">
                      <span className="flex min-w-0 items-center gap-1">
                        {row.dot && <span className="priority-dot" aria-hidden />}
                        {row.href ? <Link href={row.href} className="font-bold underline-offset-2 hover:underline">{row.label}</Link> : <span className="font-bold">{row.label}</span>}
                        {row.sublabel && <span className="text-muted-foreground"> — {row.sublabel}</span>}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {row.status && <StatusBadge tone={row.statusTone ?? "neutral"}>{row.status}</StatusBadge>}
                        {row.action}
                      </span>
                      {row.note && (
                        <span className="w-full rounded bg-amber-50 px-1.5 py-1 text-xs italic text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{row.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="min-w-0 flex-1 p-3">
                  <CategoryColumns columns={columns} accentColor={vaColor} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
