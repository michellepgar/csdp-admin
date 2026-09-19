"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { CategoryColumns, type CategoryColumn } from "@/components/category-columns";
import { Dropdown } from "@/components/dropdown";
import type { Va } from "@/lib/app-state";
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
};

function vaListRow(t: TodayActivityItem, key: number) {
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
      {t.status && <StatusBadge tone={TODAY_STATUS_TONE[t.status] ?? "neutral"}>{t.status}</StatusBadge>}
    </li>
  );
}

function columnsFor(items: TodayActivityItem[]): CategoryColumn[] {
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
      status: t.status || undefined,
      statusTone: TODAY_STATUS_TONE[t.status] ?? "neutral",
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
export function CurrentlyWorkingOn({ todayByVa, vas }: {
  todayByVa: [string, TodayActivityItem[]][];
  vas: Va[];
}) {
  const [vaFilter, setVaFilter] = useState("");
  const [viewMode, setViewMode] = useState<"columns" | "list">("columns");

  const allVaNames = todayByVa.map(([name]) => name).sort((a, b) => a.localeCompare(b));
  const visibleEntries = todayByVa
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
            return (
              <div key={vaName} className="flex overflow-hidden rounded-md border bg-record-background">
                <div className="flex w-9 shrink-0 items-center justify-center border-r py-3" style={{ color: va?.color }}>
                  <span className="whitespace-nowrap text-sm font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{vaName}</span>
                </div>
                {viewMode === "list" ? (
                  <ul className="min-w-0 flex-1 space-y-1.5 p-3">
                    {items.map((t, i) => vaListRow(t, i))}
                  </ul>
                ) : (
                  <div className="min-w-0 flex-1 p-3">
                    <CategoryColumns columns={columnsFor(items)} accentColor={va?.color} />
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
