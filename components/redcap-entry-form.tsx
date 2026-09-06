"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import {
  REDCAP_GRADES,
  REDCAP_INSURANCE_OPTIONS,
  REDCAP_DENTAL_STATUS_OPTIONS,
  REDCAP_RACE_OPTIONS,
  REDCAP_NEEDS_OPTIONS,
} from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";

/* One tap-through group of buttons -- `multi` toggles independently
   (Dental Needs, which a student can have more than one of), anything
   else behaves like a single radio pick (clicking a second option
   swaps the first one off). Selected state is just a filled button,
   no separate checkbox/radio control -- matches the "tap through
   fast" entry Michelle asked for over a real scanned form. */
function ButtonGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <Button
            key={opt}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={() => {
              if (multi) {
                onChange(selected ? value.filter((v) => v !== opt) : [...value, opt]);
              } else {
                onChange(selected ? [] : [opt]);
              }
            }}
          >
            {opt}
          </Button>
        );
      })}
    </div>
  );
}

const emptyStudent = {
  insurance: [] as string[],
  dentalHomeStatus: [] as string[],
  referral: [] as string[],
  race: [] as string[],
  fluoride: [] as string[],
  prophy: [] as string[],
  sealant: [] as string[],
  needs: [] as string[],
};

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
  const [student, setStudent] = useState(emptyStudent);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof emptyStudent>(key: K, next: string[]) {
    setStudent((s) => ({ ...s, [key]: next }));
  }

  function handleSave() {
    if (!schoolId || !schoolYear.trim() || !grade) {
      setError("Pick a school and school year above, and a grade below, first.");
      return;
    }
    if (!student.insurance[0] || !student.dentalHomeStatus[0] || !student.referral[0] || !student.race[0]) {
      setError("Insurance, Dental Home Status, Referral, and Race are all required for this student.");
      return;
    }
    setError("");

    const input: RedcapTallyInput = {
      schoolId,
      schoolYear: schoolYear.trim(),
      grade,
      insurance: student.insurance[0],
      dentalHomeStatus: student.dentalHomeStatus[0],
      referral: student.referral[0],
      race: student.race[0],
      fluoride: student.fluoride.length > 0,
      prophy: student.prophy.length > 0,
      sealed1stMolar: student.sealant.includes("1st Molar"),
      sealed2ndMolar: student.sealant.includes("2nd Molar"),
      needs: student.needs,
    };

    startTransition(async () => {
      await addRedcapTally(input);
      // School/year/grade stay put on purpose -- Michelle works
      // through a whole stack of scanned forms for the same
      // school/grade at once. Only this one student's answers clear.
      setStudent(emptyStudent);
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

      <div className="space-y-1">
        <div className="text-sm font-medium">Insurance</div>
        <ButtonGroup options={REDCAP_INSURANCE_OPTIONS} value={student.insurance} onChange={(v) => update("insurance", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Dental home status</div>
        <ButtonGroup options={REDCAP_DENTAL_STATUS_OPTIONS} value={student.dentalHomeStatus} onChange={(v) => update("dentalHomeStatus", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Referral</div>
        <ButtonGroup options={REDCAP_DENTAL_STATUS_OPTIONS} value={student.referral} onChange={(v) => update("referral", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Race</div>
        <ButtonGroup options={REDCAP_RACE_OPTIONS} value={student.race} onChange={(v) => update("race", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Fluoride / Prophy</div>
        <div className="flex flex-wrap gap-3">
          <ButtonGroup options={["Fluoride"]} value={student.fluoride} onChange={(v) => update("fluoride", v)} />
          <ButtonGroup options={["Prophy"]} value={student.prophy} onChange={(v) => update("prophy", v)} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Sealed which molar(s)?</div>
        <ButtonGroup options={["1st Molar", "2nd Molar"]} value={student.sealant} onChange={(v) => update("sealant", v)} multi />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Dental needs (check all that apply)</div>
        <ButtonGroup options={REDCAP_NEEDS_OPTIONS} value={student.needs} onChange={(v) => update("needs", v)} multi />
      </div>

      {error && <p className="text-sm text-status-danger-foreground">{error}</p>}

      <Button type="button" onClick={handleSave} disabled={isPending} className="font-semibold">
        {isPending ? "Saving…" : "Save student & clear for next →"}
      </Button>
    </div>
  );
}
