"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { TONE_CLASSES, TONE_OPTION_STYLE, type StatusTone } from "@/components/status-badge";
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
  type IssueCategory,
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
   action (it reads "type" out of the form data itself). Software
   Issue's Category/Subcategory selects submit the chosen NAME (same
   text-not-a-foreign-key convention Task's own category field uses),
   but the Subcategory options need to be filtered by whichever
   category is currently selected, hence tracking the category by name
   in local state too. */
export function AddIssueForm({
  addIssue,
  issueCategories,
  addIssueCategory,
  removeIssueCategory,
  addIssueSubcategory,
  removeIssueSubcategory,
}: {
  addIssue: (formData: FormData) => void;
  issueCategories: IssueCategory[];
  addIssueCategory: (formData: FormData) => void;
  removeIssueCategory: (formData: FormData) => void;
  addIssueSubcategory: (formData: FormData) => void;
  removeIssueSubcategory: (formData: FormData) => void;
}) {
  const [type, setType] = useState<IssueType>("software_issue");
  const [categoryName, setCategoryName] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const selectedCategory = issueCategories.find((c) => c.name === categoryName);

  return (
    <div className="space-y-2">
      <form action={addIssue} className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
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
            <button type="button" onClick={() => setEditorOpen((o) => !o)} className="text-sm text-primary underline underline-offset-2">
              {editorOpen ? "Close category editor" : "Edit categories"}
            </button>
          )}
        </div>

        {type === "software_issue" && (
          <div className="flex flex-wrap gap-2">
            <select
              name="category"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Category…</option>
              {issueCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select
              key={categoryName}
              name="subcategory"
              defaultValue=""
              disabled={!selectedCategory || selectedCategory.subcategories.length === 0}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Subcategory…</option>
              {(selectedCategory?.subcategories || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <Input name="description" placeholder="What's the issue?" required className="max-w-md flex-1" />
            <Input name="note" placeholder="Note (optional)" className="max-w-xs" />
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

      {editorOpen && type === "software_issue" && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Editing this list changes the categories/subcategories available for every Software Issue.</p>
          {issueCategories.map((c) => (
            <div key={c.id} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>{c.name}</span>
                <form action={removeIssueCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmDeleteButton confirmMessage={`Remove the "${c.name}" category and all its subcategories?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
                </form>
              </div>
              <div className="flex flex-wrap items-center gap-1 pl-2">
                {c.subcategories.map((s) => (
                  <form key={s.id} action={removeIssueSubcategory} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    <input type="hidden" name="id" value={s.id} />
                    <span>{s.name}</span>
                    <ConfirmDeleteButton confirmMessage={`Remove the "${s.name}" subcategory?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
                  </form>
                ))}
                <form action={addIssueSubcategory} className="flex items-center gap-1">
                  <input type="hidden" name="categoryId" value={c.id} />
                  <Input name="name" placeholder="New subcategory" required className="h-7 max-w-[160px] text-xs" />
                  <SubmitButton pendingLabel="…" variant="outline" size="xs">Add</SubmitButton>
                </form>
              </div>
            </div>
          ))}
          <form action={addIssueCategory} className="flex gap-2">
            <Input name="name" placeholder="New category" required />
            <SubmitButton pendingLabel="Adding…">Add category</SubmitButton>
          </form>
        </div>
      )}
    </div>
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
        {ISSUE_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s} style={TONE_OPTION_STYLE[ISSUE_STATUS_TONE[s] ?? "neutral"]}>{s}</option>
        ))}
      </select>
    </AutoSubmitForm>
  );
}

/* A free-text note about the fix, auto-saved on change -- was a list
   of sign-off chips before. */
function FixNote({ issue, setIssueFixNote }: { issue: Issue; setIssueFixNote: (formData: FormData) => void }) {
  return (
    <AutoSubmitForm action={setIssueFixNote}>
      <input type="hidden" name="id" value={issue.id} />
      <textarea
        key={issue.fixNote || ""}
        name="fixNote"
        defaultValue={issue.fixNote || ""}
        placeholder="What was done to fix this…"
        rows={1}
        className="w-full min-w-[160px] resize-y rounded-md border px-1.5 py-0.5 text-sm"
      />
    </AutoSubmitForm>
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
      <ConfirmDeleteButton confirmMessage="Remove this issue?" pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
    </form>
  );
}

/* Software Issue's own Note (issues.remarks), auto-saved the same way
   as Correction/Charting's Fix note -- a different column, different
   meaning, so kept as a separate component/action. */
function NoteField({ issue, setIssueNote }: { issue: Issue; setIssueNote: (formData: FormData) => void }) {
  return (
    <AutoSubmitForm action={setIssueNote}>
      <input type="hidden" name="id" value={issue.id} />
      <textarea
        key={issue.remarks || ""}
        name="note"
        defaultValue={issue.remarks || ""}
        placeholder="Note…"
        rows={1}
        className="w-full min-w-[140px] resize-y rounded-md border px-1.5 py-0.5 text-sm"
      />
    </AutoSubmitForm>
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
  setIssueFixNote: (formData: FormData) => void;
};

/* Each issue type gets its own table -- the four shapes don't share
   fields, so a single shared table either loses type-specific columns
   or crams them into one generic "Details" cell. Separate tables keep
   every field visible, at the cost of repeating the Reported By/Date/
   Status/delete columns four times. */

export function SoftwareIssueTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue, setIssueNote }: TableProps & { setIssueNote: (formData: FormData) => void }) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No software issues reported.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-1">Category</th>
            <th className="px-2 py-1">Subcategory</th>
            <th className="px-2 py-1">Description</th>
            <th className="px-2 py-1">Note</th>
            <th className="px-2 py-1">Reported By</th>
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-1 whitespace-nowrap">{issue.category || "—"}</td>
              <td className="px-2 py-1 whitespace-nowrap">{issue.subcategory || "—"}</td>
              <td className="px-2 py-1">{issue.description}</td>
              <td className="px-2 py-1"><NoteField issue={issue} setIssueNote={setIssueNote} /></td>
              <td className="px-2 py-1 whitespace-nowrap">{issue.reportedBy}</td>
              <td className="px-2 py-1 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
              <td className="px-2 py-1"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
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
            <th className="px-2 py-1">Student</th>
            <th className="px-2 py-1">DOB</th>
            <th className="px-2 py-1">Insurance #</th>
            <th className="px-2 py-1">School Year</th>
            <th className="px-2 py-1">File</th>
            <th className="px-2 py-1">Page</th>
            <th className="px-2 py-1">Correcting</th>
            <th className="px-2 py-1">Correct Info</th>
            <th className="px-2 py-1">Reported By</th>
            <th className="px-2 py-1">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-1">{issue.studentName}</td>
              <td className="px-2 py-1 whitespace-nowrap">{fmtDob(issue.dob)}</td>
              <td className="px-2 py-1">{issue.insuranceNumber}</td>
              <td className="px-2 py-1">{issue.schoolYear}</td>
              <td className="px-2 py-1 font-bold">{issue.fileName}</td>
              <td className="px-2 py-1">{issue.pageNumber}</td>
              <td className="px-2 py-1">{issue.correctingCategory}</td>
              <td className="px-2 py-1">{issue.correctInfo}</td>
              <td className="px-2 py-1">{issue.reportedBy}</td>
              <td className="px-2 py-1"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CorrectionTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue, setIssueFixNote }: TableProps & FixProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No correction/verification entries.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-1">Kind</th>
            <th className="px-2 py-1">Student Record</th>
            <th className="px-2 py-1">Needs</th>
            <th className="px-2 py-1">Fix</th>
            <th className="px-2 py-1">Reported By</th>
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Status</th>
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
                <td className="px-2 py-1 whitespace-nowrap">{issue.correctionKind}</td>
                <td className="px-2 py-1"><a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-primary underline">{issue.studentRecordLink}</a></td>
                <td className="px-2 py-1">{needs || "—"}</td>
                <td className="px-2 py-1"><FixNote issue={issue} setIssueFixNote={setIssueFixNote} /></td>
                <td className="px-2 py-1 whitespace-nowrap">{issue.reportedBy}</td>
                <td className="px-2 py-1 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
                <td className="px-2 py-1"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
                <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChartingTable({ issues, currentUserName, currentIsAdmin, setIssueStatus, removeIssue, setIssueFixNote }: TableProps & FixProps) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No charting questions.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="px-2 py-1">Student Record</th>
            <th className="px-2 py-1">Question</th>
            <th className="px-2 py-1">Fix</th>
            <th className="px-2 py-1">Reported By</th>
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...issues].reverse().map((issue) => (
            <tr key={issue.id} className="border-b bg-record-background align-top">
              <td className="px-2 py-1"><a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-primary underline">{issue.studentRecordLink}</a></td>
              <td className="px-2 py-1">{issue.question}</td>
              <td className="px-2 py-1"><FixNote issue={issue} setIssueFixNote={setIssueFixNote} /></td>
              <td className="px-2 py-1 whitespace-nowrap">{issue.reportedBy}</td>
              <td className="px-2 py-1 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
              <td className="px-2 py-1"><StatusSelect issue={issue} setIssueStatus={setIssueStatus} /></td>
              <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
