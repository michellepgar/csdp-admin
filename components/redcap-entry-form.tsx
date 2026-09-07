"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import { REDCAP_GRADES } from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";
import { StudentFields, emptyStudentFields, studentFieldsAreComplete, toTallyFields } from "@/components/redcap-student-fields";

export function RedcapEntryForm({
  schoolId,
  schoolYear,
  addRedcapTally,
}: {
  /* School + school year are owned by the parent shell now (shared
     with the Report/Review tabs' own pickers) -- see
     components/redcap-report-shell.tsx's own comment for why this
     used to reset itself on every tab switch when it lived here as
     local state instead. */
  schoolId: string;
  schoolYear: string;
  addRedcapTally: (input: RedcapTallyInput) => Promise<void>;
}) {
  const [grade, setGrade] = useState(REDCAP_GRADES[0]);
  const [student, setStudent] = useState(emptyStudentFields);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!schoolId || !schoolYear.trim() || !grade) {
      setError("Pick a school and school year above, and a grade below, first.");
      return;
    }
    if (!studentFieldsAreComplete(student)) {
      setError("Consent, Insurance, Dental Home Status, Referral, and Race are all required for this student.");
      return;
    }
    setError("");

    const input: RedcapTallyInput = { schoolId, schoolYear: schoolYear.trim(), grade, ...toTallyFields(student) };

    startTransition(async () => {
      await addRedcapTally(input);
      // School/year/grade stay put on purpose -- Michelle works
      // through a whole stack of scanned forms for the same
      // school/grade at once. Only this one student's answers clear.
      setStudent(emptyStudentFields);
      setSavedCount((c) => c + 1);
    });
  }

  return (
    <div className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-record-background p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Grade</label>
          <Dropdown
            name="grade"
            value={grade}
            onChange={setGrade}
            options={REDCAP_GRADES.map((g) => ({ value: g, label: g }))}
            className="w-full min-w-[140px] rounded-md border px-2 py-1.5 text-left text-sm"
          />
        </div>
        {savedCount > 0 && (
          <span className="ml-auto text-sm text-status-success-foreground">✓ {savedCount} student{savedCount === 1 ? "" : "s"} saved this session</span>
        )}
      </div>

      <StudentFields value={student} onChange={setStudent} />

      {error && <p className="text-sm text-status-danger-foreground">{error}</p>}

      <Button type="button" onClick={handleSave} disabled={isPending} className="font-semibold">
        {isPending ? "Saving…" : "Save student & clear for next →"}
      </Button>
    </div>
  );
}
