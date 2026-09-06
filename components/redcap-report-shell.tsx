"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { RedcapEntryForm } from "@/components/redcap-entry-form";
import {
  REDCAP_GRADES,
  REDCAP_INSURANCE_OPTIONS,
  REDCAP_DENTAL_STATUS_OPTIONS,
  REDCAP_RACE_OPTIONS,
  REDCAP_NEEDS_OPTIONS,
  type School,
  type RedcapTally,
} from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";

type Section = { label: string; rows: { label: string; count: (rows: RedcapTally[]) => number }[] };

function buildSections(): Section[] {
  return [
    {
      label: "Insurance",
      rows: REDCAP_INSURANCE_OPTIONS.map((opt) => ({
        label: `# ${opt}`,
        count: (rows) => rows.filter((r) => r.insurance === opt).length,
      })),
    },
    {
      label: "Dental Home Status",
      rows: REDCAP_DENTAL_STATUS_OPTIONS.map((opt) => ({
        label: `# ${opt}`,
        count: (rows) => rows.filter((r) => r.dentalHomeStatus === opt).length,
      })),
    },
    {
      label: "Referrals",
      rows: REDCAP_DENTAL_STATUS_OPTIONS.map((opt) => ({
        label: `# ${opt}`,
        count: (rows) => rows.filter((r) => r.referral === opt).length,
      })),
    },
    {
      label: "Race",
      rows: REDCAP_RACE_OPTIONS.map((opt) => ({
        label: opt,
        count: (rows) => rows.filter((r) => r.race === opt).length,
      })),
    },
    {
      label: "Treatment",
      rows: [
        { label: "Fluoride", count: (rows) => rows.filter((r) => r.fluoride).length },
        { label: "Prophy", count: (rows) => rows.filter((r) => r.prophy).length },
      ],
    },
    {
      label: "Sealant",
      rows: [
        // Event-based (a student with both molars sealed counts twice
        // here) -- matches how last year's own "Sealant" total related
        // to 1st Molar + 2nd Molar (549 + 25 = 574 in Michelle's own
        // spreadsheet), unlike "Total # of Students sealed" below.
        { label: "Sealant", count: (rows) => rows.filter((r) => r.sealed1stMolar).length + rows.filter((r) => r.sealed2ndMolar).length },
        { label: "Total # of Students sealed", count: (rows) => rows.filter((r) => r.sealed1stMolar || r.sealed2ndMolar).length },
        { label: "1st Molar", count: (rows) => rows.filter((r) => r.sealed1stMolar).length },
        { label: "2nd Molar", count: (rows) => rows.filter((r) => r.sealed2ndMolar).length },
      ],
    },
    {
      label: "Core Exp. & other dental needs",
      rows: REDCAP_NEEDS_OPTIONS.map((opt) => ({
        label: `# ${opt}`,
        count: (rows) => rows.filter((r) => r.needs.includes(opt)).length,
      })),
    },
  ];
}

function ReportTable({ rows, schoolName, schoolYear }: { rows: RedcapTally[]; schoolName: string; schoolYear: string }) {
  const grades = REDCAP_GRADES.filter((g) => rows.some((r) => r.grade === g));
  const sections = buildSections();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No students entered yet for {schoolName}, {schoolYear}.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-header-background text-left text-white">
            <th className="px-3 py-2">{schoolName} — S.Y. {schoolYear}</th>
            <th className="px-3 py-2 tabular-nums">Total</th>
            {grades.map((g) => (
              <th key={g} className="px-3 py-2 whitespace-nowrap tabular-nums">{g}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-record-background font-semibold">
            <td className="px-3 py-2">Total # of Students Screened</td>
            <td className="px-3 py-2 tabular-nums">{rows.length}</td>
            {grades.map((g) => (
              <td key={g} className="px-3 py-2 tabular-nums">{rows.filter((r) => r.grade === g).length}</td>
            ))}
          </tr>
          {sections.map((section) => (
            <Fragment key={section.label}>
              <tr className="border-b bg-title-background">
                <td colSpan={2 + grades.length} className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  {section.label}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={`${section.label}-${row.label}`} className="border-b bg-record-background">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 tabular-nums">{row.count(rows)}</td>
                  {grades.map((g) => (
                    <td key={g} className="px-3 py-2 tabular-nums">{row.count(rows.filter((r) => r.grade === g))}</td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewList({
  rows,
  removeRedcapTally,
}: {
  rows: RedcapTally[];
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing entered yet for this school/year.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-3 py-2">Grade</th>
            <th className="px-3 py-2">Insurance</th>
            <th className="px-3 py-2">Race</th>
            <th className="px-3 py-2">Sealed</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b bg-record-background">
              <td className="px-3 py-2">{r.grade}</td>
              <td className="px-3 py-2">{r.insurance}</td>
              <td className="px-3 py-2">{r.race}</td>
              <td className="px-3 py-2">
                {[r.sealed1stMolar && "1st Molar", r.sealed2ndMolar && "2nd Molar"].filter(Boolean).join(" & ") || "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm("Delete this student's entry? This can't be undone.")) return;
                    startTransition(() => removeRedcapTally(r.id));
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t bg-title-background px-3 py-2 text-xs text-muted-foreground">
        Made a mistake? Delete the entry here and re-add it correctly from the Add Student tab.
      </p>
    </div>
  );
}

export function RedcapReportShell({
  schools,
  redcapTallies,
  addRedcapTally,
  removeRedcapTally,
}: {
  schools: School[];
  redcapTallies: RedcapTally[];
  addRedcapTally: (input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  const schoolYears = useMemo(
    () => Array.from(new Set(redcapTallies.map((t) => t.schoolYear))).sort().reverse(),
    [redcapTallies]
  );

  const [tab, setTab] = useState<"report" | "add" | "review">(redcapTallies.length === 0 ? "add" : "report");
  const [schoolId, setSchoolId] = useState(schools[0]?.id || "");
  const [year, setYear] = useState(schoolYears[0] || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));

  // Snaps the year picker to the most recent year that actually has
  // data whenever the LIST of real years changes (e.g. right after
  // saving the very first entry for a brand-new year) -- but only
  // reacts to `schoolYears` itself changing, never to `year` changing
  // on its own. `year` is also depended on here (via the functional
  // update below rather than the dependency array) specifically so
  // typing a brand-new year like "2025-2026" that doesn't exist YET
  // isn't immediately snapped back on every keystroke -- confirmed
  // directly as a real bug: with `year` in the dependency array, this
  // effect re-ran on every character typed and reverted it before the
  // next one could land, making the field look frozen/dropdown-only.
  useEffect(() => {
    setYear((current) => (schoolYears.length > 0 && !schoolYears.includes(current) ? schoolYears[0] : current));
  }, [schoolYears]);

  const school = schools.find((s) => s.id === schoolId);
  const filteredRows = redcapTallies.filter((t) => t.schoolId === schoolId && t.schoolYear === year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <Button type="button" variant={tab === "report" ? "default" : "ghost"} size="sm" onClick={() => setTab("report")}>
          Report
        </Button>
        <Button type="button" variant={tab === "add" ? "default" : "ghost"} size="sm" onClick={() => setTab("add")}>
          + Add Student
        </Button>
        <Button type="button" variant={tab === "review" ? "default" : "ghost"} size="sm" onClick={() => setTab("review")}>
          Review Entries
        </Button>
      </div>

      {/* School + School Year live here, ONE level above all three
          tabs, and stay exactly as picked no matter which tab is
          active -- these used to be re-declared inside
          RedcapEntryForm's own state, which reset to a guessed
          default every time that component unmounted (i.e. every time
          you switched away from "Add Student" and back), even though
          it looked like it "remembered" your pick within one
          uninterrupted stretch of saves. Reported directly by
          Michelle: picking School/Year should hold across tabs so she
          can check the Report, jump to Add Student, and keep adding
          to the exact same school/year without re-picking either one. */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-record-background p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">School</label>
          <Dropdown
            name="redcapSchoolId"
            value={schoolId}
            onChange={setSchoolId}
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
            className="w-full min-w-[200px] rounded-md border px-2 py-1.5 text-left text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">School year</label>
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2025-2026"
            list="redcap-school-years"
            className="w-32"
          />
          <datalist id="redcap-school-years">
            {schoolYears.map((y) => (
              <option key={y} value={y} />
            ))}
          </datalist>
        </div>
      </div>

      {/* All three tabs stay mounted (hidden via CSS, not removed from
          the tree) rather than conditionally rendered -- switching
          tabs used to unmount whichever wasn't active, which is
          exactly what was resetting Add Student's in-progress Grade
          and student-answer selections too, not just School/Year.
          Keeping everything mounted means flipping to Review mid-entry
          and back leaves a half-filled student exactly as it was. */}
      <div className={tab === "add" ? "" : "hidden"}>
        <RedcapEntryForm schoolId={schoolId} schoolYear={year} addRedcapTally={addRedcapTally} />
      </div>
      <div className={tab === "report" ? "" : "hidden"}>
        <ReportTable rows={filteredRows} schoolName={school?.name || ""} schoolYear={year} />
      </div>
      <div className={tab === "review" ? "" : "hidden"}>
        <ReviewList rows={filteredRows} removeRedcapTally={removeRedcapTally} />
      </div>
    </div>
  );
}
