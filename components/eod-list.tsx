"use client";

import { useState } from "react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EodEntryForm } from "@/components/eod-entry-form";
import {
  fmtEodDate,
  fmtMonthLabel,
  fmtTime12,
  parseHoursMinutesToMinutes,
  formatMinutesAsHours,
  canDeleteEodReport,
  type EodReport,
} from "@/lib/app-state";

function todayYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

/* The same fields an "Add EOD report" submits, pre-filled from an
   existing report -- shared by every view (cards, table, mobile
   stacked cards) that offers an inline Edit. */
function EditEntryForm({ e, updateEodReport, onDone }: {
  e: EodReport;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  onDone: () => void;
}) {
  return (
    <EodEntryForm
      action={updateEodReport}
      hiddenFields={{ id: e.id }}
      defaultDate={e.date}
      defaultTimeIn={e.timeIn}
      defaultBreakStart={e.breakStart}
      defaultBreakEnd={e.breakEnd}
      defaultTimeOut={e.timeOut}
      defaultTasks={(e.tasks || []).join("\n")}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      onSuccess={onDone}
      onCancel={onDone}
    />
  );
}

function NoteEntry({
  e,
  currentUserName,
  currentIsAdmin,
  updateEodReport,
  removeEodReport,
}: {
  e: EodReport;
  currentUserName: string;
  currentIsAdmin: boolean;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  removeEodReport: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = canDeleteEodReport(e, currentUserName, currentIsAdmin);

  if (editing) {
    return <EditEntryForm e={e} updateEodReport={updateEodReport} onDone={() => setEditing(false)} />;
  }

  const hasBreak = !!(e.breakStart || e.breakEnd);
  const line1 = `EOD ${fmtEodDate(e.date)}${e.totalHours ? ` (TOTAL HOURS: ${e.totalHours})` : ""}`;
  // No break taken -- In and Out read as one row instead of Out
  // sitting alone on its own line where Resume would otherwise be.
  const line2 = hasBreak
    ? [e.timeIn ? `IN- ${fmtTime12(e.timeIn)}` : "", e.breakStart ? `BREAK- ${fmtTime12(e.breakStart)}` : ""].filter(Boolean).join(" ")
    : [e.timeIn ? `IN- ${fmtTime12(e.timeIn)}` : "", e.timeOut ? `- OUT- ${fmtTime12(e.timeOut)}` : ""].filter(Boolean).join(" ");
  const line3 = hasBreak
    ? [e.breakEnd ? `RESUME- ${fmtTime12(e.breakEnd)}` : "", e.timeOut ? `- OUT- ${fmtTime12(e.timeOut)}` : ""].filter(Boolean).join(" ")
    : "";
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <span className="text-xs font-semibold text-muted-foreground">{e.author || "Unnamed"}</span>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>Edit</Button>
            <form action={removeEodReport}>
              <input type="hidden" name="id" value={e.id} />
              <ConfirmDeleteButton confirmMessage="Remove this EOD report?" pendingLabel="…" variant="ghost" size="xs">
                Remove
              </ConfirmDeleteButton>
            </form>
          </div>
        )}
      </div>
      <div className="space-y-0.5 p-4 pt-1 text-sm">
        <div>{line1}</div>
        {line2 && <div>{line2}</div>}
        {line3 && <div>{line3}</div>}
        {(e.tasks || []).map((t, i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

function TableRow({ e, currentUserName, currentIsAdmin, updateEodReport, removeEodReport }: {
  e: EodReport;
  currentUserName: string;
  currentIsAdmin: boolean;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  removeEodReport: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = canDeleteEodReport(e, currentUserName, currentIsAdmin);

  if (editing) {
    return (
      <tr className="border-b bg-record-background">
        <td colSpan={9} className="p-2">
          <EditEntryForm e={e} updateEodReport={updateEodReport} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b bg-record-background">
      <td className="px-2 py-2">{e.author || "Unnamed"}</td>
      <td className="px-2 py-2">{fmtEodDate(e.date)}</td>
      <td className="px-2 py-2">{fmtTime12(e.timeIn)}</td>
      <td className="px-2 py-2">{fmtTime12(e.breakStart)}</td>
      <td className="px-2 py-2">{fmtTime12(e.breakEnd)}</td>
      <td className="px-2 py-2">{fmtTime12(e.timeOut)}</td>
      <td className="px-2 py-2">{e.totalHours || ""}</td>
      <td className="px-2 py-2">{(e.tasks || []).join("; ")}</td>
      <td className="px-2 py-2">
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>Edit</Button>
            <form action={removeEodReport}>
              <input type="hidden" name="id" value={e.id} />
              <ConfirmDeleteButton confirmMessage="Remove this EOD report?" pendingLabel="…" variant="ghost" size="xs">
                Remove
              </ConfirmDeleteButton>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}

function MobileCard({ e, currentUserName, currentIsAdmin, updateEodReport, removeEodReport }: {
  e: EodReport;
  currentUserName: string;
  currentIsAdmin: boolean;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  removeEodReport: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = canDeleteEodReport(e, currentUserName, currentIsAdmin);

  if (editing) {
    return <EditEntryForm e={e} updateEodReport={updateEodReport} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="space-y-2 rounded-md border bg-record-background p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{e.author || "Unnamed"}</span>
        <span className="text-muted-foreground">{fmtEodDate(e.date)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">In</div>
          <div>{fmtTime12(e.timeIn) || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Break</div>
          <div>{fmtTime12(e.breakStart) || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Resume</div>
          <div>{fmtTime12(e.breakEnd) || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Out</div>
          <div>{fmtTime12(e.timeOut) || "—"}</div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Total Hours</div>
        <div>{e.totalHours || "—"}</div>
      </div>
      {(e.tasks || []).length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Tasks</div>
          <div>{(e.tasks || []).join("; ")}</div>
        </div>
      )}
      {canEdit && (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>Edit</Button>
          <form action={removeEodReport}>
            <input type="hidden" name="id" value={e.id} />
            <ConfirmDeleteButton confirmMessage="Remove this EOD report?" pendingLabel="…" variant="ghost" size="xs">
              Remove
            </ConfirmDeleteButton>
          </form>
        </div>
      )}
    </div>
  );
}

function TableView({
  list,
  currentUserName,
  currentIsAdmin,
  updateEodReport,
  removeEodReport,
}: {
  list: EodReport[];
  currentUserName: string;
  currentIsAdmin: boolean;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  removeEodReport: (formData: FormData) => void;
}) {
  return (
    <>
      {/* Table on sm and up; a stacked card list below sm -- this
          table's 8 columns have no way to fit a phone-width screen.
          (Notes view, the default, is already card-shaped and doesn't
          need this -- this only matters if Table is picked.) */}
      <div className="hidden overflow-x-auto rounded-md border bg-card sm:block">
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
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">No EOD reports yet.</td></tr>
            )}
            {list.map((e) => (
              <TableRow key={e.id} e={e} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} updateEodReport={updateEodReport} removeEodReport={removeEodReport} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 sm:hidden">
        {list.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">No EOD reports yet.</p>}
        {list.map((e) => (
          <MobileCard key={e.id} e={e} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} updateEodReport={updateEodReport} removeEodReport={removeEodReport} />
        ))}
      </div>
    </>
  );
}

export function EodList({
  reports,
  vaNames,
  currentUserName,
  currentIsAdmin,
  updateEodReport,
  removeEodReport,
}: {
  reports: EodReport[];
  vaNames: string[];
  currentUserName: string;
  currentIsAdmin: boolean;
  updateEodReport: (formData: FormData) => Promise<{ error: string | null }>;
  removeEodReport: (formData: FormData) => void;
}) {
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
          className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
        />
        {showArchive && (
          <Dropdown
            name="filterMonth"
            value={filterMonth}
            onChange={setFilterMonth}
            placeholder="All months"
            options={[{ value: "", label: "All months" }, ...months.map((ym) => ({ value: ym, label: fmtMonthLabel(ym) }))]}
            className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
          />
        )}
        <SegmentedToggle value={viewMode} onChange={setViewMode} options={[{ value: "notes", label: "Notes" }, { value: "table", label: "Table" }]} />
      </div>

      <p className="text-sm text-muted-foreground">
        Total Hours{showArchive ? (filterMonth ? ` for ${fmtMonthLabel(filterMonth)}` : "") : ` for ${fmtMonthLabel(currentMonth)}`}
        {filterAuthor ? ` (${filterAuthor})` : ""}: <strong>{formatMinutesAsHours(totalMinutes) || "0:00"}</strong>
        {list.length ? ` across ${list.length} ${list.length === 1 ? "entry" : "entries"}` : ""}
      </p>

      {viewMode === "table" ? (
        <TableView list={list} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} updateEodReport={updateEodReport} removeEodReport={removeEodReport} />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchive ? "No archived reports match these filters." : `No EOD reports yet for ${fmtMonthLabel(currentMonth)}.`}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <NoteEntry key={e.id} e={e} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} updateEodReport={updateEodReport} removeEodReport={removeEodReport} />
          ))}
        </div>
      )}
    </div>
  );
}
