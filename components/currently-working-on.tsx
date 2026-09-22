"use client";

import { useState } from "react";
import Link from "next/link";
import type { StatusTone } from "@/components/status-badge";
import { CategoryColumns, type CategoryColumn } from "@/components/category-columns";
import { Dropdown } from "@/components/dropdown";
import type { Va, WorkNote } from "@/lib/app-state";
import { Send } from "lucide-react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { WorkNoteButton } from "@/components/work-note-button";
import { CompleteTaskButton } from "@/components/complete-task-button";
import { makeNoteLookup, parseNoteKey } from "@/lib/work-notes";
import type { TodayActivityItem } from "@/lib/shared-task-files";
import type { TaskCategory } from "@/lib/app-state";
import { normalizedCategoryName } from "@/lib/task-ordering";

/* Same status/tone pairing as tasks-card.tsx and general-tasks-list.tsx
   (their own STATUS_TONE) -- kept as its own copy here rather than a
   shared import since neither of those files exports theirs, and
   this is read-only display. */
const TODAY_STATUS_TONE: Record<string, StatusTone> = {
  "In Progress": "warning",
  Paused: "paused",
  Completed: "success",
  "Needs My Response": "warning",
  "Waiting on Them": "paused",
  // A reminder that was checked off in Your Plan.
  Reviewed: "success",
  // An Email Tracker item marked Done.
  Done: "success",
};

// What the status badge says -- a checked reminder shows a check mark.
function statusText(status: string): string {
  return status === "Reviewed" ? "✓ Reviewed" : status === "Done" ? "✓ Done" : status;
}

// A task can be checked off here unless it's already done. Reminders
// (schoolName "Reminder") are checked off in Your Plan instead.
function canComplete(t: TodayActivityItem): boolean {
  return t.schoolName !== "Reminder" && t.status !== "Completed" && !!t.itemKey && (t.itemKey.startsWith("t:") || t.itemKey.startsWith("g:"));
}

// Where a task's link goes: its school page (or General Tasks) with the task
// flagged, so the page scrolls to it and flashes it on arrival.
function itemHref(t: TodayActivityItem): string {
  const base = t.schoolId ? `/schools/${t.schoolId}` : "/general-tasks";
  const target = t.itemKey ? parseNoteKey(t.itemKey) : null;
  if (target && (target.type === "task" || target.type === "general")) return `${base}?highlightTask=${target.id}`;
  return `${base}${t.linkSuffix || ""}`;
}

/* The EOD phrase (or the category's own name, if none is set) for one
   Today item -- looks for a category matching this item's school first,
   falling back to a shared (schoolId-less) category of the same name,
   the same scoping order visibleSchoolItems uses elsewhere. */
function eodPhraseFor(t: TodayActivityItem, taskCategories: TaskCategory[]): string {
  const target = normalizedCategoryName(t.category);
  const scoped = taskCategories.find((c) => c.schoolId === t.schoolId && normalizedCategoryName(c.name) === target);
  if (scoped) return scoped.eodPhrase || scoped.name;
  const shared = taskCategories.find((c) => !c.schoolId && normalizedCategoryName(c.name) === target);
  return shared?.eodPhrase || t.category;
}

/* EOD-ready wording: "<note> - <phrase> - <file name> - <status>",
   matching the line-per-item format Michelle types into her own EOD
   reports (the note, when there is one, goes first -- e.g. a reason or
   caveat reads before what was done), so List view can be read straight
   into one instead of needing to be reworded by hand. eodLineText below
   builds the same line as plain text for "Send to EOD". */
function eodLineText(t: TodayActivityItem, taskCategories: TaskCategory[], note?: string): string {
  const notePrefix = note ? `${note} - ` : "";
  const statusSuffix = t.status ? ` - ${statusText(t.status)}` : "";
  return `${notePrefix}${eodPhraseFor(t, taskCategories)} - ${t.fileName}${statusSuffix}`;
}

function vaListRow(t: TodayActivityItem, key: number, taskCategories: TaskCategory[], note?: string, action?: React.ReactNode) {
  return (
    <li key={key} className="flex flex-wrap items-center gap-1.5 text-sm">
      {t.schoolName === "Reminder" ? (
        <span className="font-bold">{t.fileName}</span>
      ) : (
        <>
          {note && <span className="italic text-amber-800 dark:text-amber-200">{note} -</span>}
          <span>{eodPhraseFor(t, taskCategories)} -</span>
          <Link href={itemHref(t)} className="font-bold underline-offset-2 hover:underline">
            {t.fileName}
          </Link>
          {t.status && <span>- {statusText(t.status)}</span>}
        </>
      )}
      {action}
    </li>
  );
}

function columnsFor(items: TodayActivityItem[], noteFor: (item: TodayActivityItem) => string | undefined, isMine: boolean): CategoryColumn[] {
  const byCategory = new Map<string, TodayActivityItem[]>();
  for (const t of items) {
    const category = t.schoolName === "Reminder" ? "Reminder" : t.category;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(t);
  }
  return Array.from(byCategory.entries()).map(([category, rows]) => ({
    category,
    rows: rows.map((t, i) => ({
      key: `${category}-${i}`,
      label: t.fileName,
      sublabel: t.schoolName === "Reminder" ? undefined : t.schoolName,
      href: t.schoolName === "Reminder" ? undefined : itemHref(t),
      status: t.status ? statusText(t.status) : undefined,
      statusTone: TODAY_STATUS_TONE[t.status] ?? "neutral",
      note: noteFor(t),
      action: isMine && t.itemKey ? <>{canComplete(t) && <CompleteTaskButton itemKey={t.itemKey} label={t.fileName} />}<WorkNoteButton itemKey={t.itemKey} note={noteFor(t)} label={t.fileName} /></> : undefined,
    })),
  }));
}

/* Overview's "Currently Working On" section -- a filter (all VAs, or
   one at a time) and a view toggle (Columns, the category-per-column
   layout the VAs asked for; List, the older flat one-line-per-item
   layout) on top of the same per-VA data either way. Columns stays
   the default -- this is purely an alternate way to look at the same
   items, not a replacement. A client component (unlike the rest of
   this server-rendered page) purely because the filter/view choice is
   its own local, no-reload UI state. */
export function CurrentlyWorkingOn({ todayByVa, vas, workNotes, currentUserName, taskCategories }: {
  todayByVa: [string, TodayActivityItem[]][];
  vas: Va[];
  workNotes: WorkNote[];
  /** Only this person's own cards get the note button. */
  currentUserName: string;
  /** For List view's EOD-ready wording (eodPhraseFor above). */
  taskCategories: TaskCategory[];
}) {
  const noteLookup = makeNoteLookup(workNotes);
  const [vaFilter, setVaFilter] = useState("");
  const [viewMode, setViewMode] = useState<"columns" | "list">("columns");

  // Someone removed from the team no longer appears here -- the tasks
  // they signed stay on the school pages, this just hides their row.
  const currentVaNames = new Set(vas.map((v) => v.name));
  const currentEntries = todayByVa.filter(([name]) => currentVaNames.has(name));
  const allVaNames = currentEntries.map(([name]) => name).sort((a, b) => a.localeCompare(b));
  const visibleEntries = currentEntries
    .filter(([name]) => !vaFilter || name === vaFilter)
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Currently Working On</h2>
        {allVaNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              name="vaFilter"
              value={vaFilter}
              onChange={setVaFilter}
              placeholder="All VAs"
              options={[{ value: "", label: "All VAs" }, ...allVaNames.map((name) => ({ value: name, label: name }))]}
              className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
            />
            <SegmentedToggle value={viewMode} onChange={setViewMode} options={[{ value: "columns", label: "Columns" }, { value: "list", label: "List" }]} />
          </div>
        )}
      </div>
      {visibleEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity today yet.</p>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map(([vaName, items]) => {
            const va = vas.find((v) => v.name === vaName);
            const isMine = vaName === currentUserName;
            const noteFor = (t: TodayActivityItem) => noteLookup(t.itemKey, vaName);
            // What "Send to EOD" hands off to the EOD form's tasks box --
            // every real item's EOD line, one per line. Reminders are left
            // out: they're a standing nudge to check something, not a line
            // of work done today.
            const eodDraftText = items
              .filter((t) => t.schoolName !== "Reminder")
              .map((t) => eodLineText(t, taskCategories, noteFor(t)))
              .join("\n");
            return (
              <div key={vaName} className="flex overflow-hidden rounded-md border bg-record-background no-record-hover">
                <div className="flex w-9 shrink-0 items-center justify-center border-r py-3" style={{ color: va?.color }}>
                  <span className="whitespace-nowrap text-sm font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{vaName}</span>
                </div>
                {viewMode === "list" ? (
                  <div className="min-w-0 flex-1 p-3">
                    {isMine && eodDraftText && (
                      <div className="mb-1.5 flex justify-end">
                        <Link
                          href={`/eod?draftTasks=${encodeURIComponent(eodDraftText)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          <Send className="h-3 w-3" /> Send to EOD
                        </Link>
                      </div>
                    )}
                    <ul className="space-y-1.5">
                      {items.map((t, i) => vaListRow(t, i, taskCategories, noteFor(t), isMine && t.itemKey ? <>{canComplete(t) && <CompleteTaskButton itemKey={t.itemKey} label={t.fileName} />}<WorkNoteButton itemKey={t.itemKey} note={noteFor(t)} label={t.fileName} /></> : undefined))}
                    </ul>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 p-3">
                    <CategoryColumns columns={columnsFor(items, noteFor, isMine)} accentColor={va?.color} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
