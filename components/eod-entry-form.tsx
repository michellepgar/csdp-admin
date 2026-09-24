"use client";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { computeEodTotalHours, fmtEodDate } from "@/lib/app-state";
import { teamDateIso } from "@/lib/shift";

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
  existingDates,
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
  /** Adding only: dates you already have a report for, to warn before a second one. */
  existingDates?: string[];
}) {
  const [timeIn, setTimeIn] = useState(defaultTimeIn || "");
  const [tookBreak, setTookBreak] = useState(!!(defaultBreakStart || defaultBreakEnd));
  const [breakStart, setBreakStart] = useState(defaultBreakStart || "");
  const [breakEnd, setBreakEnd] = useState(defaultBreakEnd || "");
  const [timeOut, setTimeOut] = useState(defaultTimeOut || "");
  const [tasks, setTasks] = useState(defaultTasks || "");
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // Adding a new report (not editing one): hours are required, and a saved
  // report clears the form so the same report can't be added twice.
  const isAdding = !hiddenFields;
  const fieldId = useId();

  const totalHours = computeEodTotalHours(timeIn, timeOut, tookBreak ? breakStart : "", tookBreak ? breakEnd : "");

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSavedNote(null);
        const result = await action(formData);
        if (result.error) { setError(result.error); return; }
        if (isAdding) {
          setTimeIn("");
          setTimeOut("");
          setTookBreak(false);
          setBreakStart("");
          setBreakEnd("");
          setTasks("");
          setSavedNote("EOD report added.");
          // Drop the lines "Send to EOD" put in the address, so a refresh doesn't bring them back.
          router.replace(pathname, { scroll: false });
        }
        onSuccess?.();
      }}
      onSubmit={(e) => {
        const date = String(new FormData(e.currentTarget).get("date") || "");
        if (isAdding && existingDates?.includes(date) && !window.confirm(`You already have an EOD report for ${fmtEodDate(date)}. Add another one?`)) e.preventDefault();
      }}
      className="space-y-2 rounded-md border bg-card p-3"
    >
      {hiddenFields && Object.entries(hiddenFields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-date`} className="text-xs font-medium text-muted-foreground">Date</label>
          <input type="date" id={`${fieldId}-date`} name="date" defaultValue={defaultDate || teamDateIso()} required className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-timeIn`} className="text-xs font-medium text-muted-foreground">Time in</label>
          <input type="time" id={`${fieldId}-timeIn`} name="timeIn" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required={isAdding} className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        {tookBreak && (
          <>
            <div className="space-y-1">
              <label htmlFor={`${fieldId}-breakStart`} className="text-xs font-medium text-muted-foreground">Break</label>
              <input type="time" id={`${fieldId}-breakStart`} name="breakStart" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fieldId}-breakEnd`} className="text-xs font-medium text-muted-foreground">Resume</label>
              <input type="time" id={`${fieldId}-breakEnd`} name="breakEnd" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" />
            </div>
          </>
        )}
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-timeOut`} className="text-xs font-medium text-muted-foreground">Time out</label>
          <input type="time" id={`${fieldId}-timeOut`} name="timeOut" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} required={isAdding} className="rounded-md border px-2 py-1.5 text-sm" />
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
        aria-label="What you worked on"
        placeholder="What did you work on today? One item per line…"
        required
        rows={4}
        value={tasks}
        onChange={(e) => { setTasks(e.target.value); setSavedNote(null); }}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="text-sm text-status-danger-foreground">{error}</p>}
      {savedNote && <p role="status" className="text-sm text-status-success-foreground">{savedNote}</p>}
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
