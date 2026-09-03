"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_LABELS,
  CORRECTION_CATEGORIES,
  CORRECTION_KINDS,
  canDeleteIssue,
  fmtDob,
  type Issue,
  type IssueType,
} from "@/lib/app-state";

/* Issue.status is a free-form string (unlike Suggestion's, which is a
   real literal union), so this can't be an exhaustive Record keyed by
   every possible value -- hence the "?? neutral" fallback at the call
   site below for anything unrecognized. */
const ISSUE_STATUS_TONE: Record<string, StatusTone> = {
  Pending: "warning",
  Resolved: "success",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* One add form for every issue type -- which fields show depends on
   the Type picked here, but they all submit to the same addIssue
   action (it reads "type" out of the form data itself). */
export function AddIssueForm({ addIssue }: { addIssue: (formData: FormData) => void }) {
  const [type, setType] = useState<IssueType>("software_issue");

  return (
    <form action={addIssue} className="space-y-2 rounded-md border p-3">
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value as IssueType)}
        className="rounded-md border px-2 py-1.5 text-sm font-medium"
      >
        {(Object.keys(ISSUE_TYPE_LABELS) as IssueType[]).map((t) => (
          <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
        ))}
      </select>

      {type === "software_issue" && (
        <div className="flex flex-wrap gap-2">
          <Input name="category" placeholder="Category (optional)" className="max-w-[200px]" />
          <Input name="description" placeholder="What's the issue?" required className="max-w-md flex-1" />
        </div>
      )}

      {type === "record_update" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="studentName" placeholder="Student Name" />
          <Input name="dob" type="date" placeholder="Date of Birth" />
          <Input name="insuranceNumber" placeholder="Insurance #" />
          <Input name="schoolYear" placeholder="School Year" />
          <Input name="fileName" placeholder="File Name" required />
          <Input name="pageNumber" placeholder="Page #" />
          <select name="correctingCategory" defaultValue="" className="rounded-md border px-2 py-1.5 text-sm">
            <option value="" disabled>Correcting…</option>
            {CORRECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input name="correctInfo" placeholder="Correct Info" />
        </div>
      )}

      {type === "correction" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select name="correctionKind" defaultValue="Correction" className="rounded-md border px-2 py-1.5 text-sm">
              {CORRECTION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <Input name="studentRecordLink" placeholder="Link to student record" required className="max-w-md flex-1" />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground">Needs correction/verification:</span>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsNameCorrection" /> Name</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsDobCorrection" /> DOB</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsInsuranceCorrection" /> Insurance</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsOtherCorrection" /> Other</label>
            <Input name="otherCorrectionDetail" placeholder="What else needs correcting/verifying?" className="max-w-xs" />
          </div>
        </div>
      )}

      {type === "charting" && (
        <div className="flex flex-wrap gap-2">
          <Input name="studentRecordLink" placeholder="Link to student record" required className="max-w-sm" />
          <Input name="question" placeholder="What's the question or concern?" required className="max-w-md flex-1" />
        </div>
      )}

      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
    </form>
  );
}

function StatusSelect({ issue, setIssueStatus }: { issue: Issue; setIssueStatus: (formData: FormData) => void }) {
  return (
    <AutoSubmitForm action={setIssueStatus}>
      <input type="hidden" name="id" value={issue.id} />
      {/* The dropdown itself carries the status color -- not paired
          with a separate read-only badge showing the same value again. */}
      <select
        key={issue.status}
        name="status"
        defaultValue={issue.status}
        className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${TONE_CLASSES[ISSUE_STATUS_TONE[issue.status] ?? "neutral"]}`}
      >
        {ISSUE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </AutoSubmitForm>
  );
}

function FixSignatures({
  issue,
  currentUserName,
  currentIsAdmin,
  signIssueFix,
  removeIssueFixSignature,
}: {
  issue: Issue;
  currentUserName: string;
  currentIsAdmin: boolean;
  signIssueFix: (formData: FormData) => void;
  removeIssueFixSignature: (formData: FormData) => void;
}) {
  const fixedBy = issue.fixedBy || [];
  const iSigned = fixedBy.includes(currentUserName);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {fixedBy.map((name) => (
        <form key={name} action={removeIssueFixSignature} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          <input type="hidden" name="id" value={issue.id} />
          <input type="hidden" name="name" value={name} />
          <span>{name}</span>
          {(name === currentUserName || currentIsAdmin) && (
            <ConfirmDeleteButton confirmMessage={`Remove ${name}'s fix signature?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
          )}
        </form>
      ))}
      {!iSigned && (
        <form action={signIssueFix}>
          <input type="hidden" name="id" value={issue.id} />
          <SubmitButton pendingLabel="…" variant="outline" size="sm">Fix</SubmitButton>
        </form>
      )}
    </div>
  );
}

function DeleteIssueButton({
  issue,
  currentUserName,
  currentIsAdmin,
  removeIssue,
}: {
  issue: Issue;
  currentUserName: string;
  currentIsAdmin: boolean;
  removeIssue: (formData: FormData) => void;
}) {
  if (!canDeleteIssue(issue, currentUserName, currentIsAdmin)) return null;
  return (
    <form action={removeIssue}>
      <input type="hidden" name="id" value={issue.id} />
      <ConfirmDeleteButton confirmMessage="Remove this issue?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
    </form>
  );
}

type TableProps = {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
};
type FixProps = {
  signIssueFix: (formData: FormData) => void;
  removeIssueFixSignature: (formData: FormData) => void;
};

/* Each issue type gets its own table -- the four shapes don't share
   fields, so a single shared table either loses type-specific columns
   or crams them into one generic "Details" cell. Separate tables keep
   every field visible, at the cost of repeating the Reported By/Date/
   Status/delete columns four times. */

export function SoftwareIssueTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue }: TableProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No software issues reported.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-2">Category</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2">Reported By</th>
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-2 whitespace-nowrap">{issue.category || "—"}</td>
              <td className="px-2 py-2">{issue.description}</td>
              <td className="px-2 py-2 whitespace-nowrap">{issue.reportedBy}</td>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
              <td className="px-2 py-2"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-2"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecordUpdateTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue }: TableProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No record update entries.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-2">Student</th>
            <th className="px-2 py-2">DOB</th>
            <th className="px-2 py-2">Insurance #</th>
            <th className="px-2 py-2">School Year</th>
            <th className="px-2 py-2">File</th>
            <th className="px-2 py-2">Page</th>
            <th className="px-2 py-2">Correcting</th>
            <th className="px-2 py-2">Correct Info</th>
            <th className="px-2 py-2">Reported By</th>
            <th className="px-2 py-2">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-2">{issue.studentName}</td>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDob(issue.dob)}</td>
              <td className="px-2 py-2">{issue.insuranceNumber}</td>
              <td className="px-2 py-2">{issue.schoolYear}</td>
              <td className="px-2 py-2 font-bold">{issue.fileName}</td>
              <td className="px-2 py-2">{issue.pageNumber}</td>
              <td className="px-2 py-2">{issue.correctingCategory}</td>
              <td className="px-2 py-2">{issue.correctInfo}</td>
              <td className="px-2 py-2">{issue.reportedBy}</td>
              <td className="px-2 py-2"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-2"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CorrectionTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue, signIssueFix, removeIssueFixSignature }: TableProps & FixProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No correction/verification entries.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-2">Kind</th>
            <th className="px-2 py-2">Student Record</th>
            <th className="px-2 py-2">Needs</th>
            <th className="px-2 py-2">Fix</th>
            <th className="px-2 py-2">Reported By</th>
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => {
            const needs = [
              issue.needsNameCorrection && "Name",
              issue.needsDobCorrection && "DOB",
              issue.needsInsuranceCorrection && "Insurance",
              issue.needsOtherCorrection && (issue.otherCorrectionDetail || "Other"),
            ].filter(Boolean).join(", ");
            return (
              <tr key={issue.id} className="border-b bg-record-background align-top">
                <td className="px-2 py-2 whitespace-nowrap">{issue.correctionKind}</td>
                <td className="px-2 py-2"><a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-primary underline">{issue.studentRecordLink}</a></td>
                <td className="px-2 py-2">{needs || "—"}</td>
                <td className="px-2 py-2"><FixSignatures issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} signIssueFix={signIssueFix} removeIssueFixSignature={removeIssueFixSignature} /></td>
                <td className="px-2 py-2 whitespace-nowrap">{issue.reportedBy}</td>
                <td className="px-2 py-2 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
                <td className="px-2 py-2"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
                <td className="px-2 py-2"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChartingTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue, signIssueFix, removeIssueFixSignature }: TableProps & FixProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No charting questions.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-2">Student Record</th>
            <th className="px-2 py-2">Question</th>
            <th className="px-2 py-2">Fix</th>
            <th className="px-2 py-2">Reported By</th>
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-2"><a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-primary underline">{issue.studentRecordLink}</a></td>
              <td className="px-2 py-2">{issue.question}</td>
              <td className="px-2 py-2"><FixSignatures issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} signIssueFix={signIssueFix} removeIssueFixSignature={removeIssueFixSignature} /></td>
              <td className="px-2 py-2 whitespace-nowrap">{issue.reportedBy}</td>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
              <td className="px-2 py-2"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-2"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
