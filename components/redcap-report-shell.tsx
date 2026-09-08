"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { RedcapEntryForm } from "@/components/redcap-entry-form";
import {
  StudentFields,
  studentFieldsFromTally,
  studentFieldsAreComplete,
  toTallyFields,
  type StudentFieldsState,
} from "@/components/redcap-student-fields";
import {
  REDCAP_GRADES,
  REDCAP_SCHOOL_YEARS,
  REDCAP_INSURANCE_OPTIONS,
  REDCAP_DENTAL_STATUS_OPTIONS,
  REDCAP_RACE_OPTIONS,
  REDCAP_NEEDS_OPTIONS,
  type School,
  type RedcapTally,
} from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";

// A pseudo school id, never a real one -- picking it shows every
// school's own report table stacked one after another for the picked
// year, the way Michelle actually compiles the final REDCap
// submission (one sheet per site). Add Student stays school-specific;
// Review and Flags both support it (Flags especially -- checking
// every site at once for the final submission is the whole point).
const ALL_SCHOOLS = "__all__";

// A grade is worth its own column/breakdown the moment it has EITHER
// a real student entry OR a Distributed count typed in for it --
// Michelle often knows how many forms went out to a grade before
// anyone from that grade has actually been screened. Shared by
// ReportTable and the Flags checks so both agree on which grades are
// "in play" for a school/year.
function gradesInPlay(rows: RedcapTally[], distributedByGrade: Record<string, number>) {
  return REDCAP_GRADES.filter((g) => rows.some((r) => r.grade === g) || (distributedByGrade[g] || 0) > 0);
}

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

/* "Distributed" is Michelle's own typed-in number, not derived from
   any entered student -- local draft state so it doesn't fire a save
   on every keystroke, committed on blur/Enter like every other
   inline-editable number in this app. */
function DistributedFormsInput({ value, onSave }: { value: number; onSave: (next: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(value));
  const [isPending, startTransition] = useTransition();

  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const parsed = parseInt(draft, 10) || 0;
    if (parsed !== value) startTransition(() => onSave(parsed));
  }

  return (
    <Input
      type="number"
      min={0}
      value={draft}
      disabled={isPending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-24 tabular-nums"
    />
  );
}

function ReportTable({
  rows,
  schoolName,
  schoolYear,
  distributedForms,
  onSetDistributedForms,
}: {
  rows: RedcapTally[];
  schoolName: string;
  schoolYear: string;
  distributedForms: Record<string, number>;
  onSetDistributedForms: (grade: string, next: number) => Promise<void>;
}) {
  const grades = gradesInPlay(rows, distributedForms);
  const sections = buildSections();
  const positiveConsentCount = rows.filter((r) => r.consent === "Positive").length;
  const distributedTotal = grades.reduce((sum, g) => sum + (distributedForms[g] || 0), 0);

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
          <tr className="border-b bg-title-background">
            <td colSpan={2 + grades.length} className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Total # of Consent Forms Received and Returned at This Site
            </td>
          </tr>
          <tr className="border-b bg-record-background">
            <td className="px-3 py-2">Distributed</td>
            <td className="px-3 py-2 font-semibold tabular-nums">{distributedTotal}</td>
            {grades.map((g) => (
              <td key={g} className="px-3 py-2">
                <DistributedFormsInput value={distributedForms[g] || 0} onSave={(count) => onSetDistributedForms(g, count)} />
              </td>
            ))}
          </tr>
          <tr className="border-b bg-record-background">
            <td className="px-3 py-2">Positive Consent</td>
            <td className="px-3 py-2 tabular-nums">{positiveConsentCount}</td>
            {grades.map((g) => (
              <td key={g} className="px-3 py-2 tabular-nums">{rows.filter((r) => r.grade === g && r.consent === "Positive").length}</td>
            ))}
          </tr>

          {rows.length === 0 ? (
            <tr>
              <td colSpan={2 + grades.length} className="px-3 py-4 text-sm text-muted-foreground">
                No students entered yet for {schoolName}, {schoolYear}.
              </td>
            </tr>
          ) : (
            <>
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
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* One row in the Review table -- doubles as its own inline editor.
   Replaces the old "delete and re-add from Add Student" fix flow: the
   full set of answers is visible right in the table for scanning by
   eye, and "Edit" turns this same row into the same field editor the
   Add Student form uses (components/redcap-student-fields.tsx),
   saving via updateRedcapTally instead of a fresh addRedcapTally. */
function ReviewRow({
  tally,
  updateRedcapTally,
  removeRedcapTally,
}: {
  tally: RedcapTally;
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [grade, setGrade] = useState(tally.grade);
  const [fileName, setFileName] = useState(tally.fileName || "");
  const [student, setStudent] = useState<StudentFieldsState>(() => studentFieldsFromTally(tally));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setGrade(tally.grade);
    setFileName(tally.fileName || "");
    setStudent(studentFieldsFromTally(tally));
    setError("");
    setEditing(true);
  }

  function handleSave() {
    if (!grade || !studentFieldsAreComplete(student)) {
      setError("Grade, Consent, Insurance, Dental Home Status, Referral, and Race are all required.");
      return;
    }
    setError("");
    const input: RedcapTallyInput = {
      schoolId: tally.schoolId,
      schoolYear: tally.schoolYear,
      grade,
      fileName: fileName.trim() || undefined,
      ...toTallyFields(student),
    };
    startTransition(async () => {
      await updateRedcapTally(tally.id, input);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="border-b bg-muted/30">
        <td colSpan={11} className="p-3">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Grade</label>
                <Dropdown
                  name="grade"
                  value={grade}
                  onChange={setGrade}
                  options={REDCAP_GRADES.map((g) => ({ value: g, label: g }))}
                  className="w-full max-w-[180px] rounded-md border px-2 py-1.5 text-left text-sm"
                />
              </div>
              <div className="min-w-[220px] flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">File name (for tracking mistakes -- not shown on the report)</label>
                <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="text-sm" />
              </div>
            </div>
            <StudentFields value={student} onChange={setStudent} />
            {error && <p className="text-sm text-status-danger-foreground">{error}</p>}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleSave} disabled={isPending} className="font-semibold">
                {isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  const sealed = [tally.sealed1stMolar && "1st Molar", tally.sealed2ndMolar && "2nd Molar"].filter(Boolean).join(" & ") || "—";

  return (
    <tr className="border-b bg-record-background">
      <td className="px-3 py-2 whitespace-nowrap">{tally.grade}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.consent || "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.insurance}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.dentalHomeStatus}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.referral}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.race}</td>
      <td className="px-3 py-2 whitespace-nowrap">{[tally.fluoride && "Fluoride", tally.prophy && "Prophy"].filter(Boolean).join(", ") || "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{sealed}</td>
      <td className="px-3 py-2 whitespace-nowrap">{tally.needs.join(", ") || "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground" title="For tracking mistakes -- never shown on the Report tab">
        {tally.fileName || "—"}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Button type="button" variant="ghost" size="sm" onClick={startEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm("Delete this student's entry? This can't be undone.")) return;
            startTransition(() => removeRedcapTally(tally.id));
          }}
        >
          Delete
        </Button>
      </td>
    </tr>
  );
}

function ReviewList({
  rows,
  updateRedcapTally,
  removeRedcapTally,
}: {
  rows: RedcapTally[];
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing entered yet for this school/year.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-3 py-2">Grade</th>
            <th className="px-3 py-2">Consent</th>
            <th className="px-3 py-2">Insurance</th>
            <th className="px-3 py-2">Dental Home</th>
            <th className="px-3 py-2">Referral</th>
            <th className="px-3 py-2">Race</th>
            <th className="px-3 py-2">Treatment</th>
            <th className="px-3 py-2">Sealed</th>
            <th className="px-3 py-2">Needs</th>
            <th className="px-3 py-2" title="For tracking mistakes -- never shown on the Report tab">File</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ReviewRow key={r.id} tally={r} updateRedcapTally={updateRedcapTally} removeRedcapTally={removeRedcapTally} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Flag = {
  id: string;
  severity: "error" | "warning";
  message: string;
  tallyIds: string[];
};

/* The actual "catch mistakes before submitting" logic Michelle asked
   for -- things that are either logically impossible (a consent form
   marked Negative shouldn't have any treatment recorded; more
   positive consents or screened students than forms distributed) or
   just worth a second look (Dental Home Status/Referral left
   Unknown/Left Blank a lot suggests rushed entry). Scoped to one
   school at a time; the caller runs this once per school for "All
   Schools". */
function computeFlags(schoolName: string, rows: RedcapTally[], distributedByGrade: Record<string, number>): Flag[] {
  const flags: Flag[] = [];

  const negativeWithTreatment = rows.filter(
    (r) => r.consent === "Negative" && (r.fluoride || r.prophy || r.sealed1stMolar || r.sealed2ndMolar || r.needs.length > 0)
  );
  if (negativeWithTreatment.length > 0) {
    flags.push({
      id: `${schoolName}-neg-treatment`,
      severity: "error",
      message: `${schoolName}: ${negativeWithTreatment.length} student${negativeWithTreatment.length === 1 ? "" : "s"} marked Consent = Negative but have treatment recorded (Fluoride/Prophy/Sealant/Needs)`,
      tallyIds: negativeWithTreatment.map((r) => r.id),
    });
  }

  for (const g of gradesInPlay(rows, distributedByGrade)) {
    const distributed = distributedByGrade[g] || 0;
    const gradeRows = rows.filter((r) => r.grade === g);
    const screened = gradeRows.length;
    const positiveConsent = gradeRows.filter((r) => r.consent === "Positive").length;
    if (distributed > 0 && screened > distributed) {
      flags.push({
        id: `${schoolName}-${g}-screened`,
        severity: "error",
        message: `${schoolName}, ${g}: ${screened} students screened but only ${distributed} forms distributed`,
        tallyIds: gradeRows.map((r) => r.id),
      });
    }
    if (distributed > 0 && positiveConsent > distributed) {
      flags.push({
        id: `${schoolName}-${g}-consent`,
        severity: "error",
        message: `${schoolName}, ${g}: ${positiveConsent} positive consents but only ${distributed} forms distributed`,
        tallyIds: gradeRows.filter((r) => r.consent === "Positive").map((r) => r.id),
      });
    }
  }

  const blankDentalHome = rows.filter((r) => r.dentalHomeStatus === "Unknown / Left Blank");
  if (blankDentalHome.length > 0) {
    flags.push({
      id: `${schoolName}-blank-dental`,
      severity: "warning",
      message: `${schoolName}: ${blankDentalHome.length} student${blankDentalHome.length === 1 ? "" : "s"} have Dental Home Status marked Unknown/Left Blank`,
      tallyIds: blankDentalHome.map((r) => r.id),
    });
  }

  const blankReferral = rows.filter((r) => r.referral === "Unknown / Left Blank");
  if (blankReferral.length > 0) {
    flags.push({
      id: `${schoolName}-blank-referral`,
      severity: "warning",
      message: `${schoolName}: ${blankReferral.length} student${blankReferral.length === 1 ? "" : "s"} have Referral marked Unknown/Left Blank`,
      tallyIds: blankReferral.map((r) => r.id),
    });
  }

  return flags;
}

function FlagRow({
  flag,
  tallies,
  updateRedcapTally,
  removeRedcapTally,
}: {
  flag: Flag;
  tallies: RedcapTally[];
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const affected = tallies.filter((t) => flag.tallyIds.includes(t.id));
  const toneClass = flag.severity === "error" ? "border-status-danger-foreground/40 bg-status-danger" : "border-status-warning-foreground/40 bg-status-warning";
  const textClass = flag.severity === "error" ? "text-status-danger-foreground" : "text-status-warning-foreground";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-medium ${textClass}`}>{flag.message}</p>
        {affected.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className={textClass} onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Hide entries" : "Show entries"}
          </Button>
        )}
      </div>
      {expanded && affected.length > 0 && (
        <div className="mt-3">
          <ReviewList rows={affected} updateRedcapTally={updateRedcapTally} removeRedcapTally={removeRedcapTally} />
        </div>
      )}
    </div>
  );
}

function FlagsPanel({
  schools,
  schoolId,
  year,
  redcapTallies,
  distributedByGradeFor,
  updateRedcapTally,
  removeRedcapTally,
}: {
  schools: School[];
  schoolId: string;
  year: string;
  redcapTallies: RedcapTally[];
  distributedByGradeFor: (sid: string) => Record<string, number>;
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
}) {
  const scopedSchools = schoolId === ALL_SCHOOLS ? schools : schools.filter((s) => s.id === schoolId);

  const flags = scopedSchools.flatMap((s) => {
    const rows = redcapTallies.filter((t) => t.schoolId === s.id && t.schoolYear === year);
    return computeFlags(s.name, rows, distributedByGradeFor(s.id));
  });

  if (flags.length === 0) {
    return (
      <p className="text-sm text-status-success-foreground">
        ✓ No discrepancies found for {schoolId === ALL_SCHOOLS ? "any school" : scopedSchools[0]?.name || "this school"}, {year}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {flags.filter((f) => f.severity === "error").length} thing{flags.filter((f) => f.severity === "error").length === 1 ? "" : "s"} likely need fixing, {flags.filter((f) => f.severity === "warning").length} worth a second look.
      </p>
      {flags.map((flag) => (
        <FlagRow key={flag.id} flag={flag} tallies={redcapTallies} updateRedcapTally={updateRedcapTally} removeRedcapTally={removeRedcapTally} />
      ))}
    </div>
  );
}

export function RedcapReportShell({
  schools,
  redcapTallies,
  redcapDistributedForms,
  addRedcapTally,
  updateRedcapTally,
  removeRedcapTally,
  setRedcapDistributedForms,
}: {
  schools: School[];
  redcapTallies: RedcapTally[];
  redcapDistributedForms: Record<string, number>;
  addRedcapTally: (input: RedcapTallyInput) => Promise<void>;
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
  removeRedcapTally: (id: string) => Promise<void>;
  setRedcapDistributedForms: (schoolId: string, schoolYear: string, grade: string, count: number) => Promise<void>;
}) {
  const schoolYears = useMemo(
    () => Array.from(new Set(redcapTallies.map((t) => t.schoolYear))).sort().reverse(),
    [redcapTallies]
  );
  // Datalist suggestions only -- REDCAP_SCHOOL_YEARS' presets plus
  // whatever years already have real data, deduped. Deliberately kept
  // separate from `schoolYears` above, which the auto-snap effect
  // below uses to mean "years with actual data" specifically -- mixing
  // in the presets there would make it snap to e.g. 2026-2027 just
  // because it's suggested, not because anything's been entered for it.
  const yearSuggestions = useMemo(
    () => Array.from(new Set([...REDCAP_SCHOOL_YEARS, ...schoolYears])).sort().reverse(),
    [schoolYears]
  );

  const [tab, setTab] = useState<"report" | "add" | "review" | "flags">(redcapTallies.length === 0 ? "add" : "report");
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

  // Narrows the flat `${schoolId}:${schoolYear}:${grade}`-keyed map
  // down to just {grade: count} for one school+year -- ReportTable
  // only ever needs to think in terms of grade. Takes `sid` as a
  // parameter (rather than closing over the picked `schoolId`) so the
  // "All Schools" view below can call this once per real school.
  function distributedByGradeFor(sid: string) {
    const prefix = `${sid}:${year}:`;
    const result: Record<string, number> = {};
    for (const [key, count] of Object.entries(redcapDistributedForms)) {
      if (key.startsWith(prefix)) result[key.slice(prefix.length)] = count;
    }
    return result;
  }

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
        <Button type="button" variant={tab === "flags" ? "default" : "ghost"} size="sm" onClick={() => setTab("flags")}>
          Flags
        </Button>
      </div>

      {/* School + School Year live here, ONE level above all tabs, and
          stay exactly as picked no matter which tab is active -- these
          used to be re-declared inside RedcapEntryForm's own state,
          which reset to a guessed default every time that component
          unmounted (i.e. every time you switched away from "Add
          Student" and back), even though it looked like it
          "remembered" your pick within one uninterrupted stretch of
          saves. Reported directly by Michelle: picking School/Year
          should hold across tabs so she can check the Report, jump to
          Add Student, and keep adding to the exact same school/year
          without re-picking either one. */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-record-background p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">School</label>
          <Dropdown
            name="redcapSchoolId"
            value={schoolId}
            onChange={setSchoolId}
            options={[{ value: ALL_SCHOOLS, label: "All Schools" }, ...schools.map((s) => ({ value: s.id, label: s.name }))]}
            className="w-full min-w-[200px] rounded-md border px-2 py-1.5 text-left text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">School year</label>
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="YYYY-YYYY"
            list="redcap-school-years"
            className="w-32"
          />
          <datalist id="redcap-school-years">
            {yearSuggestions.map((y) => (
              <option key={y} value={y} />
            ))}
          </datalist>
        </div>
      </div>

      {/* All four tabs stay mounted (hidden via CSS, not removed from
          the tree) rather than conditionally rendered -- switching
          tabs used to unmount whichever wasn't active, which is
          exactly what was resetting Add Student's in-progress Grade
          and student-answer selections too, not just School/Year.
          Keeping everything mounted means flipping to Review mid-entry
          and back leaves a half-filled student exactly as it was. */}
      <div className={tab === "add" ? "" : "hidden"}>
        {schoolId === ALL_SCHOOLS ? (
          <p className="text-sm text-muted-foreground">Pick a specific school above to add a student.</p>
        ) : (
          <RedcapEntryForm schoolId={schoolId} schoolYear={year} addRedcapTally={addRedcapTally} />
        )}
      </div>
      <div className={tab === "report" ? "" : "hidden"}>
        {schoolId === ALL_SCHOOLS ? (
          // Every school's own table, stacked -- matches how Michelle
          // actually compiles the final REDCap submission (one sheet
          // per site), rather than a single table trying to cram every
          // school into one set of grade columns.
          <div className="space-y-6">
            {schools.map((s) => (
              <ReportTable
                key={s.id}
                rows={redcapTallies.filter((t) => t.schoolId === s.id && t.schoolYear === year)}
                schoolName={s.name}
                schoolYear={year}
                distributedForms={distributedByGradeFor(s.id)}
                onSetDistributedForms={(grade, count) => setRedcapDistributedForms(s.id, year, grade, count)}
              />
            ))}
          </div>
        ) : (
          <ReportTable
            rows={filteredRows}
            schoolName={school?.name || ""}
            schoolYear={year}
            distributedForms={distributedByGradeFor(schoolId)}
            onSetDistributedForms={(grade, count) => setRedcapDistributedForms(schoolId, year, grade, count)}
          />
        )}
      </div>
      <div className={tab === "review" ? "" : "hidden"}>
        {schoolId === ALL_SCHOOLS ? (
          <p className="text-sm text-muted-foreground">Pick a specific school above to review its entries.</p>
        ) : (
          <ReviewList rows={filteredRows} updateRedcapTally={updateRedcapTally} removeRedcapTally={removeRedcapTally} />
        )}
      </div>
      <div className={tab === "flags" ? "" : "hidden"}>
        <FlagsPanel
          schools={schools}
          schoolId={schoolId}
          year={year}
          redcapTallies={redcapTallies}
          distributedByGradeFor={distributedByGradeFor}
          updateRedcapTally={updateRedcapTally}
          removeRedcapTally={removeRedcapTally}
        />
      </div>
    </div>
  );
}
