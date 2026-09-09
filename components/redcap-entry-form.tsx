"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { REDCAP_GRADES, REDCAP_VISITS, type RedcapTally } from "@/lib/app-state";
import type { RedcapTallyInput } from "@/app/(app)/redcap-report/actions";
import {
  StudentFields,
  emptyStudentFields,
  studentFieldsAreComplete,
  studentFieldsFromTally,
  toTallyFields,
  findMatchingStudent,
  visitsSeenLabel,
} from "@/components/redcap-student-fields";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RedcapEntryForm({
  schoolId,
  schoolYear,
  existingStudents,
  addRedcapTally,
  updateRedcapTally,
}: {
  /* School + school year are owned by the parent shell now (shared
     with the Report/Review tabs' own pickers) -- see
     components/redcap-report-shell.tsx's own comment for why this
     used to reset itself on every tab switch when it lived here as
     local state instead. */
  schoolId: string;
  schoolYear: string;
  /* This school+year's existing tallies -- already fetched by the
     parent shell, reused here for both the automatic name-match check
     and the manual "search students" fallback rather than a separate
     round trip. */
  existingStudents: RedcapTally[];
  addRedcapTally: (input: RedcapTallyInput) => Promise<void>;
  updateRedcapTally: (id: string, input: RedcapTallyInput) => Promise<void>;
}) {
  const [grade, setGrade] = useState(REDCAP_GRADES[0]);
  const [fileName, setFileName] = useState("");
  const [student, setStudent] = useState(emptyStudentFields);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [visit, setVisit] = useState<(typeof REDCAP_VISITS)[number]>("Initial");
  const [dateOfService, setDateOfService] = useState(today);
  // Set once a match is confirmed (either via the auto-detected
  // prompt below, or picked from "search students") -- save then
  // UPDATEs this row instead of inserting a new one. Cleared whenever
  // the typed Name changes, since editing the name after a match was
  // found almost certainly means "actually, different student."
  const [matchedTally, setMatchedTally] = useState<RedcapTally | null>(null);
  // A same-name candidate found on Name blur, not yet confirmed or
  // rejected -- drives the "Is this the same student?" prompt.
  const [matchCandidate, setMatchCandidate] = useState<RedcapTally | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function applyMatch(t: RedcapTally) {
    setMatchedTally(t);
    setMatchCandidate(null);
    setName(t.studentName || name);
    setDob((d) => d || t.dateOfBirth || "");
    setInsuranceNumber((v) => v || t.insuranceNumber || "");
    setGrade(t.grade);
    setStudent(studentFieldsFromTally(t));
    // Default the Visit picker to whichever visit this student HASN'T
    // been seen at yet -- if they've somehow already got both (or
    // neither), leave whatever was already picked alone.
    if (t.seenInitialDate && !t.seenFollowUpDate) setVisit("Follow-up");
    else if (t.seenFollowUpDate && !t.seenInitialDate) setVisit("Initial");
    setSearchOpen(false);
    setSearchQuery("");
  }

  function handleNameBlur() {
    if (matchedTally) return; // already matched, don't re-check
    const found = findMatchingStudent(existingStudents, schoolId, schoolYear, name);
    setMatchCandidate(found || null);
  }

  function handleSave() {
    if (!schoolId || !schoolYear.trim() || !grade) {
      setError("Pick a school and school year above, and a grade below, first.");
      return;
    }
    if (!name.trim()) {
      setError("Student name is required.");
      return;
    }
    if (!studentFieldsAreComplete(student)) {
      setError("Consent, Insurance, Dental Home Status, Referral, and Race are all required for this student.");
      return;
    }
    setError("");

    const input: RedcapTallyInput = {
      schoolId,
      schoolYear: schoolYear.trim(),
      grade,
      fileName: fileName.trim() || undefined,
      studentName: name.trim(),
      dateOfBirth: dob.trim() || undefined,
      insuranceNumber: insuranceNumber.trim() || undefined,
      seenInitialDate: visit === "Initial" ? dateOfService : matchedTally?.seenInitialDate,
      seenFollowUpDate: visit === "Follow-up" ? dateOfService : matchedTally?.seenFollowUpDate,
      ...toTallyFields(student),
    };

    startTransition(async () => {
      if (matchedTally) {
        await updateRedcapTally(matchedTally.id, input);
      } else {
        await addRedcapTally(input);
      }
      // School/year/grade/file name all stay put on purpose -- one
      // scanned file is usually a whole batch of students from the
      // same school/grade, so the file name should carry over to the
      // next entry by default too. Only this one student's own
      // identity/answers clear; type over the file name yourself once
      // you start a new file.
      setStudent(emptyStudentFields);
      setName("");
      setDob("");
      setInsuranceNumber("");
      setVisit("Initial");
      setDateOfService(today());
      setMatchedTally(null);
      setMatchCandidate(null);
      setSavedCount((c) => c + 1);
    });
  }

  const filteredSearchResults = searchQuery.trim()
    ? existingStudents
        .filter((t) => (t.studentName || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-record-background p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Student name</label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMatchedTally(null);
              setMatchCandidate(null);
            }}
            onBlur={handleNameBlur}
            className="min-w-[180px] text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">File name (for tracking mistakes -- not shown on the report)</label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="min-w-[220px] text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date of birth (optional)</label>
          <Input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="MM/DD/YYYY" className="min-w-[130px] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Insurance # (optional)</label>
          <Input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} className="min-w-[150px] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Visit</label>
          <Dropdown
            name="visit"
            value={visit}
            onChange={(v) => setVisit(v as (typeof REDCAP_VISITS)[number])}
            options={REDCAP_VISITS.map((v) => ({ value: v, label: v }))}
            className="w-full min-w-[120px] rounded-md border px-2 py-1.5 text-left text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date of service</label>
          <Input type="date" value={dateOfService} onChange={(e) => setDateOfService(e.target.value)} className="min-w-[150px] text-sm" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setSearchOpen((o) => !o)}>
          {searchOpen ? "Hide student search" : "Search existing students"}
        </Button>
      </div>

      {searchOpen && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a name to search this school/year…"
            className="text-sm"
          />
          <div className="space-y-1">
            {filteredSearchResults.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyMatch(t)}
                className="block w-full rounded-md border bg-record-background px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {t.studentName}
                {t.dateOfBirth ? ` — DOB ${t.dateOfBirth}` : ""} ({visitsSeenLabel(t)})
              </button>
            ))}
            {searchQuery.trim() && filteredSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No students found matching &quot;{searchQuery}&quot;.</p>
            )}
          </div>
        </div>
      )}

      {matchCandidate && (
        <div className="space-y-2 rounded-md border border-status-warning-foreground/40 bg-status-warning p-3">
          <p className="text-sm text-status-warning-foreground">
            Is this the same student as <strong>{matchCandidate.studentName}</strong>
            {matchCandidate.dateOfBirth ? `, DOB ${matchCandidate.dateOfBirth}` : ""}, already seen at{" "}
            {visitsSeenLabel(matchCandidate)}?
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => applyMatch(matchCandidate)}>
              Yes, same student
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMatchCandidate(null)}>
              No, different student
            </Button>
          </div>
        </div>
      )}

      {matchedTally && (
        <p className="text-sm text-status-success-foreground">
          ✓ Updating {matchedTally.studentName}&apos;s existing record ({visitsSeenLabel(matchedTally)} on file).
        </p>
      )}

      <StudentFields value={student} onChange={setStudent} />

      {error && <p className="text-sm text-status-danger-foreground">{error}</p>}

      <Button type="button" onClick={handleSave} disabled={isPending} className="font-semibold">
        {isPending ? "Saving…" : "Save student & clear for next →"}
      </Button>

      {savedCount > 0 && (
        <p className="text-sm text-status-success-foreground">✓ {savedCount} student{savedCount === 1 ? "" : "s"} saved this session</p>
      )}
    </div>
  );
}
