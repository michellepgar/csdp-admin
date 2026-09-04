"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import {
  fmtEodDate,
  fmtMonthLabel,
  fmtTime12,
  parseHoursMinutesToMinutes,
  formatMinutesAsHours,
  type EodReport,
} from "@/lib/app-state";

function todayYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function NoteEntry({ e }: { e: EodReport }) {
  const line1 = `EOD ${fmtEodDate(e.date)}${e.totalHours ? ` (TOTAL HOURS: ${e.totalHours})` : ""}`;
  const line2 = [e.timeIn ? `IN- ${fmtTime12(e.timeIn)}` : "", e.breakStart ? `BREAK- ${fmtTime12(e.breakStart)}` : ""].filter(Boolean).join(" ");
  const line3 = [e.breakEnd ? `RESUME- ${fmtTime12(e.breakEnd)}` : "", e.timeOut ? `- OUT- ${fmtTime12(e.timeOut)}` : ""].filter(Boolean).join(" ");
  return (
    <div className="mb-3 rounded-md border bg-card">
      <div className="px-4 pt-2 text-xs font-semibold text-muted-foreground">{e.author || "Unnamed"}</div>
      <div className="space-y-0.5 p-4 pt-1 text-sm">
        <div>{line1}</div>
        {line2 && <div>{line2}</div>}
        {line3 && <div>{line3}</div>}
        {(e.tasks || []).map((t, i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

function TableView({ list }: { list: EodReport[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-2">VA</th>
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">In</th>
            <th className="px-2 py-2">Break</th>
            <th className="px-2 py-2">Resume</th>
            <th className="px-2 py-2">Out</th>
            <th className="px-2 py-2">Total Hours</th>
            <th className="px-2 py-2">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">No EOD reports yet.</td></tr>
          )}
          {list.map((e) => (
            <tr key={e.id} className="border-b bg-record-background">
              <td className="px-2 py-2">{e.author || "Unnamed"}</td>
              <td className="px-2 py-2">{fmtEodDate(e.date)}</td>
              <td className="px-2 py-2">{fmtTime12(e.timeIn)}</td>
              <td className="px-2 py-2">{fmtTime12(e.breakStart)}</td>
              <td className="px-2 py-2">{fmtTime12(e.breakEnd)}</td>
              <td className="px-2 py-2">{fmtTime12(e.timeOut)}</td>
              <td className="px-2 py-2">{e.totalHours || ""}</td>
              <td className="px-2 py-2">{(e.tasks || []).join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EodList({ reports, vaNames }: { reports: EodReport[]; vaNames: string[] }) {
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [viewMode, setViewMode] = useState<"notes" | "table">("notes");

  const currentMonth = todayYearMonth();
  const monthSet = new Set<string>();
  reports.forEach((e) => { if (e.date && e.date.slice(0, 7) !== currentMonth) monthSet.add(e.date.slice(0, 7)); });
  const months = Array.from(monthSet).sort().reverse();

  const list = [...reports].reverse().filter((e) => {
    if (filterAuthor && e.author !== filterAuthor) return false;
    const entryMonth = (e.date || "").slice(0, 7);
    if (showArchive) {
      if (entryMonth === currentMonth) return false;
      if (filterMonth && entryMonth !== filterMonth) return false;
    } else if (entryMonth !== currentMonth) {
      return false;
    }
    return true;
  });

  const totalMinutes = list.reduce((sum, e) => sum + parseHoursMinutesToMinutes(e.totalHours), 0);

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={() => setShowArchive((s) => !s)}>
        {showArchive ? "← Back to this month" : "View Archive (previous months)"}
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          name="filterAuthor"
          value={filterAuthor}
          onChange={setFilterAuthor}
          placeholder="All team members"
          options={[{ value: "", label: "All team members" }, ...[...vaNames].sort().map((name) => ({ value: name, label: name }))]}
          className="rounded-md border px-2 py-1.5 text-left text-sm"
        />
        {showArchive && (
          <Dropdown
            name="filterMonth"
            value={filterMonth}
            onChange={setFilterMonth}
            placeholder="All months"
            options={[{ value: "", label: "All months" }, ...months.map((ym) => ({ value: ym, label: fmtMonthLabel(ym) }))]}
            className="rounded-md border px-2 py-1.5 text-left text-sm"
          />
        )}
        <div className="flex overflow-hidden rounded-md border">
          <button type="button" onClick={() => setViewMode("notes")} className={`px-3 py-1.5 text-sm ${viewMode === "notes" ? "bg-primary text-primary-foreground" : ""}`}>Notes</button>
          <button type="button" onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-sm ${viewMode === "table" ? "bg-primary text-primary-foreground" : ""}`}>Table</button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Total Hours{showArchive ? (filterMonth ? ` for ${fmtMonthLabel(filterMonth)}` : "") : ` for ${fmtMonthLabel(currentMonth)}`}
        {filterAuthor ? ` (${filterAuthor})` : ""}: <strong>{formatMinutesAsHours(totalMinutes) || "0:00"}</strong>
        {list.length ? ` across ${list.length} ${list.length === 1 ? "entry" : "entries"}` : ""}
      </p>

      {viewMode === "table" ? (
        <TableView list={list} />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchive ? "No archived reports match these filters." : `No EOD reports yet for ${fmtMonthLabel(currentMonth)}.`}
        </p>
      ) : (
        list.map((e) => <NoteEntry key={e.id} e={e} />)
      )}
    </div>
  );
}
