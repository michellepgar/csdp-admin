"use client";

import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { ISSUE_STATUS_OPTIONS, canDeleteIssue, type Issue } from "@/lib/app-state";

/* Issue.status is a free-form string (unlike AccessRequest's or
   Suggestion's status, which are real literal unions), so this can't
   be an exhaustive Record keyed by every possible value the way those
   two are — hence the "?? neutral" fallback at the call site below
   for anything unrecognized. */
const ISSUE_STATUS_TONE: Record<string, StatusTone> = {
  Pending: "warning",
  Resolved: "success",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusSelect({ issue, setIssueStatus }: { issue: Issue; setIssueStatus: (formData: FormData) => void }) {
  return (
    <div className="flex items-center gap-2">
      <StatusBadge tone={ISSUE_STATUS_TONE[issue.status] ?? "neutral"}>{issue.status}</StatusBadge>
      <AutoSubmitForm action={setIssueStatus}>
        <input type="hidden" name="id" value={issue.id} />
        <select key={issue.status} name="status" defaultValue={issue.status} className="rounded-md border px-2 py-1 text-xs">
          {ISSUE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </AutoSubmitForm>
    </div>
  );
}

function DeleteButton({
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
      <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
    </form>
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
            <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
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

export function SoftwareIssueTable({
  issues,
  currentUserName,
  currentIsAdmin,
  setIssueStatus,
  removeIssue,
}: {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
}) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No software issues reported.</p>;
  return (
    <div className="space-y-2">
      {[...issues].reverse().map((issue) => (
        <div key={issue.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div>
            {issue.category && <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs">{issue.category}</span>}
            <p className="mt-1 text-sm">{issue.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">{issue.reportedBy} · {fmtDate(issue.createdAt)}</p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <StatusSelect issue={issue} setIssueStatus={setIssueStatus} />
            <DeleteButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecordUpdateTable({
  issues,
  currentUserName,
  currentIsAdmin,
  setIssueStatus,
  removeIssue,
}: {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
}) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No record update entries.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
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
            <tr key={issue.id} className="border-b">
              <td className="px-2 py-2">{issue.studentName}</td>
              <td className="px-2 py-2">{issue.dob}</td>
              <td className="px-2 py-2">{issue.insuranceNumber}</td>
              <td className="px-2 py-2">{issue.schoolYear}</td>
              <td className="px-2 py-2 font-mono">{issue.fileName}</td>
              <td className="px-2 py-2">{issue.pageNumber}</td>
              <td className="px-2 py-2">{issue.correctingCategory}</td>
              <td className="px-2 py-2">{issue.correctInfo}</td>
              <td className="px-2 py-2">{issue.reportedBy}</td>
              <td className="px-2 py-2"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-2"><DeleteButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CorrectionTable({
  issues,
  currentUserName,
  currentIsAdmin,
  setIssueStatus,
  removeIssue,
  signIssueFix,
  removeIssueFixSignature,
}: {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
  signIssueFix: (formData: FormData) => void;
  removeIssueFixSignature: (formData: FormData) => void;
}) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No correction/verification entries.</p>;
  return (
    <div className="space-y-2">
      {[...issues].reverse().map((issue) => {
        const needs = [
          issue.needsNameCorrection && "Name",
          issue.needsDobCorrection && "DOB",
          issue.needsInsuranceCorrection && "Insurance",
          issue.needsOtherCorrection && (issue.otherCorrectionDetail || "Other"),
        ].filter(Boolean).join(", ");
        return (
          <div key={issue.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{issue.correctionKind}</span>
                <a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="ml-2 text-sm text-primary underline">
                  {issue.studentRecordLink}
                </a>
                <p className="mt-1 text-sm">Needs: {needs || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{issue.reportedBy} · {fmtDate(issue.createdAt)}</p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <StatusSelect issue={issue} setIssueStatus={setIssueStatus} />
                <DeleteButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} />
              </div>
            </div>
            <FixSignatures issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} signIssueFix={signIssueFix} removeIssueFixSignature={removeIssueFixSignature} />
          </div>
        );
      })}
    </div>
  );
}

export function ChartingTable({
  issues,
  currentUserName,
  currentIsAdmin,
  setIssueStatus,
  removeIssue,
  signIssueFix,
  removeIssueFixSignature,
}: {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
  signIssueFix: (formData: FormData) => void;
  removeIssueFixSignature: (formData: FormData) => void;
}) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No charting questions.</p>;
  return (
    <div className="space-y-2">
      {[...issues].reverse().map((issue) => (
        <div key={issue.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                {issue.studentRecordLink}
              </a>
              <p className="mt-1 text-sm">{issue.question}</p>
              <p className="mt-1 text-xs text-muted-foreground">{issue.reportedBy} · {fmtDate(issue.createdAt)}</p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <StatusSelect issue={issue} setIssueStatus={setIssueStatus} />
              <DeleteButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} />
            </div>
          </div>
          <FixSignatures issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} signIssueFix={signIssueFix} removeIssueFixSignature={removeIssueFixSignature} />
        </div>
      ))}
    </div>
  );
}
