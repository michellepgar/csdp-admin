"use client";

import { Button } from "@/components/ui/button";
import {
  REDCAP_INSURANCE_OPTIONS,
  REDCAP_DENTAL_STATUS_OPTIONS,
  REDCAP_RACE_OPTIONS,
  REDCAP_NEEDS_OPTIONS,
  REDCAP_CONSENT_OPTIONS,
  type RedcapTally,
} from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";

/* Shared by the Add Student form and Review/Flags' inline edit row --
   every place a single student's answers get entered or corrected
   uses this same set of fields, so a fix (like the "Unknown / Left
   Blank" option added earlier) only has to happen once. */

/* One tap-through group of buttons -- `multi` toggles independently
   (Dental Needs, which a student can have more than one of), anything
   else behaves like a single radio pick (clicking a second option
   swaps the first one off). Selected state is just a filled button,
   no separate checkbox/radio control -- matches the "tap through
   fast" entry Michelle asked for over a real scanned form. */
export function ButtonGroup({
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

// Every field is kept as a string[] (0 or 1 item for single-select,
// 0+ for multi-select) so ButtonGroup's own selected/toggle logic
// works identically for both kinds of field -- avoids a separate
// "single vs multi" data shape for what's visually the same control.
export type StudentFieldsState = {
  consent: string[];
  insurance: string[];
  dentalHomeStatus: string[];
  referral: string[];
  race: string[];
  fluoride: string[];
  prophy: string[];
  sealant: string[];
  needs: string[];
};

export const emptyStudentFields: StudentFieldsState = {
  consent: [],
  insurance: [],
  dentalHomeStatus: [],
  referral: [],
  race: [],
  fluoride: [],
  prophy: [],
  sealant: [],
  needs: [],
};

// Converts an existing saved RedcapTally back into StudentFieldsState
// for editing -- the inverse of toTallyFields below.
export function studentFieldsFromTally(t: RedcapTally): StudentFieldsState {
  return {
    consent: t.consent ? [t.consent] : [],
    insurance: t.insurance ? [t.insurance] : [],
    dentalHomeStatus: t.dentalHomeStatus ? [t.dentalHomeStatus] : [],
    referral: t.referral ? [t.referral] : [],
    race: t.race ? [t.race] : [],
    fluoride: t.fluoride ? ["Fluoride"] : [],
    prophy: t.prophy ? ["Prophy"] : [],
    sealant: [t.sealed1stMolar && "1st Molar", t.sealed2ndMolar && "2nd Molar"].filter(Boolean) as string[],
    needs: t.needs,
  };
}

// The four single-select fields that are actually required before a
// save is allowed -- shared so Add and Edit enforce the same rule.
export function studentFieldsAreComplete(s: StudentFieldsState) {
  return !!(s.consent[0] && s.insurance[0] && s.dentalHomeStatus[0] && s.race[0] && s.referral[0]);
}

// Converts StudentFieldsState into the field subset RedcapTallyInput
// needs (caller still has to add schoolId/schoolYear/grade).
export function toTallyFields(s: StudentFieldsState): Omit<RedcapTallyInput, "schoolId" | "schoolYear" | "grade"> {
  return {
    insurance: s.insurance[0],
    dentalHomeStatus: s.dentalHomeStatus[0],
    referral: s.referral[0],
    race: s.race[0],
    consent: s.consent[0],
    fluoride: s.fluoride.length > 0,
    prophy: s.prophy.length > 0,
    sealed1stMolar: s.sealant.includes("1st Molar"),
    sealed2ndMolar: s.sealant.includes("2nd Molar"),
    needs: s.needs,
  };
}

// REDCap v2's dedup check (see
// docs/superpowers/specs/2026-09-09-redcap-v2-student-dedup-design.md)
// -- name match only (trimmed, case-insensitive), scoped to the same
// school + school year. DOB/Insurance # are too often missing or
// wrong on the scanned forms to gate the match on, per Michelle --
// they're shown alongside a found match for a human to eyeball
// instead. Returns the first match, or undefined if the name is blank
// or nothing matches.
export function findMatchingStudent(
  existing: RedcapTally[],
  schoolId: string,
  schoolYear: string,
  name: string
): RedcapTally | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return existing.find(
    (t) =>
      t.schoolId === schoolId &&
      t.schoolYear === schoolYear &&
      (t.studentName || "").trim().toLowerCase() === normalized
  );
}

// "Initial", "Follow-up", or "Initial & Follow-up" -- derived from
// which of seenInitialDate/seenFollowUpDate are set. Used by the
// match-confirm prompt and the Review Entries "Seen At" column.
export function visitsSeenLabel(t: RedcapTally): string {
  const seen = [t.seenInitialDate && "Initial", t.seenFollowUpDate && "Follow-up"].filter(Boolean);
  return seen.length > 0 ? seen.join(" & ") : "—";
}

export function StudentFields({ value, onChange }: { value: StudentFieldsState; onChange: (next: StudentFieldsState) => void }) {
  function update<K extends keyof StudentFieldsState>(key: K, next: string[]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">Consent</div>
        <ButtonGroup options={REDCAP_CONSENT_OPTIONS} value={value.consent} onChange={(v) => update("consent", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Insurance</div>
        <ButtonGroup options={REDCAP_INSURANCE_OPTIONS} value={value.insurance} onChange={(v) => update("insurance", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Dental home status</div>
        <ButtonGroup options={REDCAP_DENTAL_STATUS_OPTIONS} value={value.dentalHomeStatus} onChange={(v) => update("dentalHomeStatus", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Referral</div>
        <ButtonGroup options={REDCAP_DENTAL_STATUS_OPTIONS} value={value.referral} onChange={(v) => update("referral", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Race</div>
        <ButtonGroup options={REDCAP_RACE_OPTIONS} value={value.race} onChange={(v) => update("race", v)} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Fluoride / Prophy</div>
        <div className="flex flex-wrap gap-3">
          <ButtonGroup options={["Fluoride"]} value={value.fluoride} onChange={(v) => update("fluoride", v)} />
          <ButtonGroup options={["Prophy"]} value={value.prophy} onChange={(v) => update("prophy", v)} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Sealed which molar(s)?</div>
        <ButtonGroup options={["1st Molar", "2nd Molar"]} value={value.sealant} onChange={(v) => update("sealant", v)} multi />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">Dental needs (check all that apply)</div>
        <ButtonGroup options={REDCAP_NEEDS_OPTIONS} value={value.needs} onChange={(v) => update("needs", v)} multi />
      </div>
    </div>
  );
}
