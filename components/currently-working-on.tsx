"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { CategoryColumns, type CategoryColumn } from "@/components/category-columns";
import { Dropdown } from "@/components/dropdown";
import type { Va, WorkNote } from "@/lib/app-state";
import { StickyNote } from "lucide-react";
import { WorkNoteButton } from "@/components/work-note-button";
import { makeNoteLookup } from "@/lib/work-notes";
import type { TodayActivityItem } from "@/lib/shared-task-files";

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
};

// What the status badge says -- a checked reminder shows a check mark.
function statusText(status: string): string {
  return status === "Reviewed" ? "✓ Reviewed" : status;
}

function vaListRow(t: TodayActivityItem, key: number, note?: string, action?: React.ReactNode) {
  return (
    <li key={key} className="flex flex-wrap items-center gap-1.5 text-sm">
      {t.schoolName === "Reminder" ? (
        <span className="font-bold">{t.fileName}</span>
      ) : (
        <>
          <Link href={`${t.schoolId ? `/schools/${t.schoolId}` : "/general-tasks"}${t.linkSuffix || ""}`} className="font-bold underline-offset-2 hover:underline">
            {t.fileName}
          </Link>
          <span className="text-muted-foreground"> — {t.schoolName} · {t.category}</span>
        </>
      )}
      {t.status && <StatusBadge tone={TODAY_STATUS_TONE[t.status] ?? "neutral"}>{statusText(t.status)}</StatusBadge>}
      {action}
      {note && (
        <span className="flex w-full items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-xs italic text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3 w-3 flex-none" />
          {note}
        </span>
      )}
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
      href: t.schoolName === "Reminder" ? undefined : `${t.schoolId ? `/schools/${t.schoolId}` : "/general-tasks"}${t.linkSuffix || ""}`,
      status: t.status ? statusText(t.status) : undefined,
      statusTone: TODAY_STATUS_TONE[t.status] ?? "neutral",
      note: noteFor(t),
      action: isMine && t.itemKey ? <WorkNoteButton itemKey={t.itemKey} note={noteFor(t)} label={t.fileName} /> : undefined,
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
export function CurrentlyWorkingOn({ todayByVa, vas, workNotes, currentUserName }: {
  todayByVa: [string, TodayActivityItem[]][];
  vas: Va[];
  workNotes: WorkNote[];
  /** Only this person's own cards get the note button. */
  currentUserName: string;
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
            <div className="flex overflow-hidden rounded-md border bg-card">
              <button type="button" onClick={() => setViewMode("columns")} className={`px-3 py-1.5 text-sm ${viewMode === "columns" ? "bg-primary text-primary-foreground" : ""}`}>Columns</button>
              <button type="button" onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-primary text-primary-foreground" : ""}`}>List</button>
            </div>
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
            return (
              <div key={vaName} className="flex overflow-hidden rounded-md border bg-record-background no-record-hover">
                <div className="flex w-9 shrink-0 items-center justify-center border-r py-3" style={{ color: va?.color }}>
                  <span className="whitespace-nowrap text-sm font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{vaName}</span>
                </div>
                {viewMode === "list" ? (
                  <ul className="min-w-0 flex-1 space-y-1.5 p-3">
                    {items.map((t, i) => vaListRow(t, i, noteFor(t), isMine && t.itemKey ? <WorkNoteButton itemKey={t.itemKey} note={noteFor(t)} label={t.fileName} /> : undefined))}
                  </ul>
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
