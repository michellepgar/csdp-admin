"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { computeEodTotalHours } from "@/lib/app-state";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/* Shared by the "Add EOD report" form at the top of the page and, with
   defaults filled in and an onCancel/onSuccess pair, an existing
   report's inline "Edit" form (eod-list.tsx) -- same fields, same
   validation, same live total-hours preview either way.

   The four time fields are controlled (unlike Date/Tasks below, which
   stay plain uncontrolled inputs) purely so computeEodTotalHours --
   the exact same function actions.ts uses to compute the saved
   total_hours -- can run on every keystroke and show a live preview
   before Save is ever clicked. Michelle asked to see the running
   total as she fills these in, not just after saving. */
export function EodEntryForm({
  action,
  defaultDate,
  defaultTimeIn,
  defaultBreakStart,
  defaultBreakEnd,
  defaultTimeOut,
  defaultTasks,
  hiddenFields,
  submitLabel = "Add EOD report",
  pendingLabel = "Adding…",
  onSuccess,
  onCancel,
}: {
  action: (formData: FormData) => Promise<{ error: string | null }>;
  defaultDate?: string;
  defaultTimeIn?: string;
  defaultBreakStart?: string;
  defaultBreakEnd?: string;
  defaultTimeOut?: string;
  defaultTasks?: string;
  /** Extra hidden inputs the action needs -- just {id: report.id} when editing. */
  hiddenFields?: Record<string, string>;
  submitLabel?: string;
  pendingLabel?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [timeIn, setTimeIn] = useState(defaultTimeIn || "");
  const [tookBreak, setTookBreak] = useState(!!(defaultBreakStart || defaultBreakEnd));
  const [breakStart, setBreakStart] = useState(defaultBreakStart || "");
  const [breakEnd, setBreakEnd] = useState(defaultBreakEnd || "");
  const [timeOut, setTimeOut] = useState(defaultTimeOut || "");
  const [error, setError] = useState<string | null>(null);

  const totalHours = computeEodTotalHours(timeIn, timeOut, tookBreak ? breakStart : "", tookBreak ? breakEnd : "");

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await action(formData);
        if (result.error) { setError(result.error); return; }
        onSuccess?.();
      }}
      className="space-y-2 rounded-md border bg-card p-3"
    >
      {hiddenFields && Object.entries(hiddenFields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <input type="date" name="date" defaultValue={defaultDate || todayIsoDate()} required className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time in</label>
          <input type="time" name="timeIn" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        {tookBreak && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Break</label>
              <input type="time" name="breakStart" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Resume</label>
              <input type="time" name="breakEnd" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
            </div>
          </>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time out</label>
          <input type="time" name="timeOut" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={tookBreak}
            onChange={(e) => {
              setTookBreak(e.target.checked);
              if (!e.target.checked) { setBreakStart(""); setBreakEnd(""); }
            }}
          />
          Took a break
        </label>
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
        defaultValue={defaultTasks || ""}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="text-sm text-status-danger-foreground">{error}</p>}
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
