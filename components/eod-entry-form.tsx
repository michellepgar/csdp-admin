"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { computeEodTotalHours } from "@/lib/app-state";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/* The four time fields are controlled (unlike Date/Tasks below, which
   stay plain uncontrolled inputs) purely so computeEodTotalHours --
   the exact same function actions.ts uses to compute the saved
   total_hours -- can run on every keystroke and show a live preview
   before Save is ever clicked. Michelle asked to see the running
   total as she fills these in, not just after saving. */
export function EodEntryForm({ addEodReport }: { addEodReport: (formData: FormData) => void }) {
  const [timeIn, setTimeIn] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [timeOut, setTimeOut] = useState("");

  const totalHours = computeEodTotalHours(timeIn, timeOut, breakStart, breakEnd);

  return (
    <form action={addEodReport} className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <input type="date" name="date" defaultValue={todayIsoDate()} required className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time in</label>
          <input type="time" name="timeIn" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Break</label>
          <input type="time" name="breakStart" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Resume</label>
          <input type="time" name="breakEnd" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time out</label>
          <input type="time" name="timeOut" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
      </div>
      <p className="text-sm">
        Total hours so far: <strong>{totalHours || "—"}</strong>
        {!totalHours && <span className="text-xs text-muted-foreground"> (fill in Time in and Time out to see it)</span>}
      </p>
      <textarea
        name="tasks"
        placeholder="What did you work on today? One item per line…"
        required
        rows={4}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <SubmitButton pendingLabel="Adding…">Add EOD report</SubmitButton>
    </form>
  );
}
