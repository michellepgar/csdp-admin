"use client";

import { Fragment, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
import { Dropdown } from "@/components/dropdown";
import { Input } from "@/components/ui/input";
import { CommentToggleButton, CommentThreadPanel } from "@/components/comment-thread";
import {
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_LABELS,
  canDeleteIssue,
  type Issue,
  type IssueType,
  type IssueCategory,
  type IssueCustomType,
  type Va,
} from "@/lib/app-state";

/* Issue.status is a free-form string (unlike Suggestion's, which is a
   real literal union), so this can't be an exhaustive Record keyed by
   every possible value -- hence the "?? neutral" fallback at the call
   site below for anything unrecognized. */
const ISSUE_STATUS_TONE: Record<string, StatusTone> = {
  Pending: "warning",
  Resolved: "success",
};

/* An explicit timeZone is required here, not just a display preference
   -- this component renders during SSR (Vercel's server runs in UTC)
   and then hydrates in the viewer's browser (whatever timezone that
   is). Without forcing both sides to agree, toLocaleDateString silently
   produced a different string on the server vs. the client for roughly
   a third of the day (whenever the two timezones' calendar dates
   differed), which React treats as a hydration mismatch (React error
   #418) -- confirmed directly on production. "America/New_York" (not a
   fixed UTC offset) is Michelle's own working timezone and
   automatically accounts for EST/EDT. */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
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
  issueTypes,
  addIssueType,
  removeIssueType,
  issueCategories,
  addIssueCategory,
  removeIssueCategory,
  addIssueSubcategory,
  removeIssueSubcategory,
}: {
  addIssue: (formData: FormData) => void;
  issueTypes: IssueCustomType[];
  addIssueType: (formData: FormData) => Promise<{ error: string | null }>;
  removeIssueType: (formData: FormData) => Promise<{ error: string | null }>;
  issueCategories: IssueCategory[];
  addIssueCategory: (formData: FormData) => void;
  removeIssueCategory: (formData: FormData) => void;
  addIssueSubcategory: (formData: FormData) => void;
  removeIssueSubcategory: (formData: FormData) => void;
}) {
  // A built-in type's key, or "custom:<id>" for one the team added.
  const [type, setType] = useState<string>("software_issue");
  const [categoryName, setCategoryName] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);
  const customType = issueTypes.find((t) => `custom:${t.id}` === type);
  const selectedCategory = issueCategories.find((c) => c.name === categoryName);

  return (
    <div className="space-y-2">
      <form action={addIssue} className="space-y-2 rounded-md border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <input type="hidden" name="type" value={customType ? "custom" : type} />
          {customType && <input type="hidden" name="customTypeId" value={customType.id} />}
          <Dropdown
            name="typeChoice"
            value={type}
            onChange={setType}
            options={[
              ...(Object.keys(ISSUE_TYPE_LABELS) as IssueType[]).map((t) => ({ value: t, label: ISSUE_TYPE_LABELS[t] })),
              ...issueTypes.map((t) => ({ value: `custom:${t.id}`, label: t.name })),
            ]}
            className="rounded-md border bg-card px-2 py-1.5 text-left text-sm font-medium"
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setTypesOpen((o) => !o)} className="text-sm text-primary underline underline-offset-2">
              {typesOpen ? "Close type editor" : "+ New type"}
            </button>
          {type === "software_issue" && (
            <button type="button" onClick={() => setEditorOpen((o) => !o)} className="text-sm text-primary underline underline-offset-2">
              {editorOpen ? "Close category editor" : "Edit categories"}
            </button>
          )}
          </div>
        </div>

        {customType && (
          <div className="flex flex-wrap gap-2">
            <Input name="description" placeholder={`Describe the ${customType.name.toLowerCase()}`} required className="min-w-40 max-w-md flex-1" />
            <Input name="note" placeholder="Note (optional)" className="max-w-xs" />
          </div>
        )}

        {type === "software_issue" && (
          <div className="flex flex-wrap gap-2">
            <Dropdown
              name="category"
              value={categoryName}
              onChange={setCategoryName}
              placeholder="Category…"
              options={issueCategories.map((c) => ({ value: c.name, label: c.name }))}
              className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
            />
            <Dropdown
              key={categoryName}
              name="subcategory"
              placeholder="Subcategory…"
              disabled={!selectedCategory || selectedCategory.subcategories.length === 0}
              options={(selectedCategory?.subcategories || []).map((s) => ({ value: s.name, label: s.name }))}
              className="rounded-md border bg-card px-2 py-1.5 text-left text-sm"
            />
            <Input name="description" placeholder="What's the issue?" required className="min-w-40 max-w-md flex-1" />
            <Input name="note" placeholder="Note (optional)" className="max-w-xs" />
          </div>
        )}

      {(type === "correction" || type === "charting") && (
        <div className="flex flex-wrap gap-2">
          <Input name="school" placeholder="School" className="max-w-[10rem]" />
          <Input name="studentName" placeholder="Name" className="max-w-[10rem]" />
          <Input name="studentRecordLink" placeholder="Link to student record" required className="min-w-40 max-w-md flex-1" />
          <Input name="note" placeholder="Note (optional)" className="max-w-xs" />
        </div>
      )}

        <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      </form>

      {typesOpen && (
        <div className="space-y-3 rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">Add your own kind of issue or concern. It gets its own list on this page and shows up in the type menu above.</p>
          <form
            action={async (formData) => {
              const result = await addIssueType(formData);
              setTypeError(result.error);
              if (!result.error) setNewTypeName("");
            }}
            className="flex gap-2"
          >
            <Input name="name" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="New type, e.g. Scanner problem" required maxLength={60} />
            <SubmitButton pendingLabel="Adding…">Add type</SubmitButton>
          </form>
          {typeError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{typeError}</p>}
          {issueTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {issueTypes.map((t) => (
                <form
                  key={t.id}
                  action={async (formData) => {
                    const result = await removeIssueType(formData);
                    setTypeError(result.error);
                    if (!result.error && type === `custom:${t.id}`) setType("software_issue");
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm"
                >
                  <input type="hidden" name="id" value={t.id} />
                  <span>{t.name}</span>
                  <ConfirmDeleteButton confirmMessage={`Remove the "${t.name}" type? A type that still has issues filed under it can't be removed.`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
                </form>
              ))}
            </div>
          )}
        </div>
      )}

      {editorOpen && type === "software_issue" && (
        <div className="space-y-3 rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">Editing this list changes the categories/subcategories available for every Software Issue.</p>
          <form action={addIssueCategory} className="flex gap-2">
            <Input name="name" placeholder="New category" required />
            <SubmitButton pendingLabel="Adding…">Add category</SubmitButton>
          </form>
          {issueCategories.map((c) => (
            <div key={c.id} className="space-y-1 rounded-md border bg-record-background p-2">
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
        </div>
      )}
    </div>
  );
}

function StatusSelectField({ issue, setIssueStatus }: { issue: Issue; setIssueStatus: (formData: FormData) => void }) {
  return (
    <StatusSelect
      action={setIssueStatus}
      hiddenFields={{ id: issue.id }}
      value={issue.status}
      options={ISSUE_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
      toneClassName={TONE_CLASSES[ISSUE_STATUS_TONE[issue.status] ?? "neutral"]}
      optionToneClassName={(v) => TONE_CLASSES[ISSUE_STATUS_TONE[v] ?? "neutral"]}
    />
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

type TableProps = {
  issues: Issue[];
  currentUserName: string;
  currentIsAdmin: boolean;
  vas: Va[];
  expandIssueId?: string;
  setIssueStatus: (formData: FormData) => void;
  removeIssue: (formData: FormData) => void;
  addIssueComment: (formData: FormData) => void;
  editIssueComment: (formData: FormData) => void;
  removeIssueComment: (formData: FormData) => void;
  ackIssueComments: (formData: FormData) => void;
};

/* Each issue type gets its own table -- the four shapes don't share
   fields, so a single shared table either loses type-specific columns
   or crams them into one generic "Details" cell. Separate tables keep
   every field visible, at the cost of repeating the Reported By/Date/
   Status/delete/Comments columns four times. */

export function SoftwareIssueTable({ showCategory = true, emptyText = "No software issues reported.", issues, currentUserName, currentIsAdmin, vas, expandIssueId, setIssueStatus, removeIssue, addIssueComment, editIssueComment, removeIssueComment, ackIssueComments }: TableProps & { showCategory?: boolean; emptyText?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(expandIssueId ?? null);
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const reversed = [...issues].reverse();
  return (
    <>
      {/* Table on sm and up; a stacked card list below sm -- this
          table's 8 columns (several holding their own inline-editable
          widgets) have no way to fit a phone-width screen. */}
      <div className="hidden overflow-x-auto rounded-md border bg-card sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
              {showCategory && (
                <>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1">Subcategory</th>
                </>
              )}
              <th className="px-2 py-1">Description</th>
              {!showCategory && <th className="px-2 py-1">Note</th>}
              <th className="px-2 py-1">Reported By</th>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Comments</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reversed.map((issue) => (
              <Fragment key={issue.id}>
                <tr className="border-b bg-record-background align-top">
                  {showCategory && (
                    <>
                      <td className="px-2 py-1 whitespace-nowrap">{issue.category || "—"}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{issue.subcategory || "—"}</td>
                    </>
                  )}
                  <td className="px-2 py-1">{issue.description}</td>
                  {!showCategory && <td className="px-2 py-1 text-muted-foreground">{issue.remarks || "—"}</td>}
                  <td className="px-2 py-1 whitespace-nowrap">{issue.reportedBy}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDate(issue.createdAt)}</td>
                  <td className="px-2 py-1"><StatusSelectField issue={issue} setIssueStatus={setIssueStatus} /></td>
                  <td className="px-2 py-1">
                    <CommentToggleButton
                      comments={issue.comments || []}
                      commentAckBy={issue.commentAckBy || []}
                      currentUserName={currentUserName}
                      expanded={expandedId === issue.id}
                      onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                      onAck={() => {
                        const fd = new FormData();
                        fd.set("issueId", issue.id);
                        ackIssueComments(fd);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
                </tr>
                {expandedId === issue.id && (
                  <tr className="border-b bg-record-background no-record-hover">
                    <td colSpan={showCategory ? 8 : 7} className="p-2">
                      <CommentThreadPanel comments={issue.comments || []} vas={vas} currentUserName={currentUserName} hiddenFields={{ issueId: issue.id }} addComment={addIssueComment} editComment={editIssueComment} removeComment={removeIssueComment} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 sm:hidden">
        {reversed.map((issue) => (
          <div key={issue.id} className="space-y-2 rounded-md border bg-record-background p-3 text-sm">
            {showCategory && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Category</div>
                  <div>{issue.category || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Subcategory</div>
                  <div>{issue.subcategory || "—"}</div>
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Description</div>
              <div>{issue.description}</div>
            </div>
            {!showCategory && issue.remarks && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Note</div>
                <div>{issue.remarks}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Reported By</div>
                <div>{issue.reportedBy}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Date</div>
                <div>{fmtDate(issue.createdAt)}</div>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Status</div>
              <StatusSelectField issue={issue} setIssueStatus={setIssueStatus} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Comments</div>
              <CommentToggleButton
                comments={issue.comments || []}
                commentAckBy={issue.commentAckBy || []}
                currentUserName={currentUserName}
                expanded={expandedId === issue.id}
                onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                onAck={() => {
                  const fd = new FormData();
                  fd.set("issueId", issue.id);
                  ackIssueComments(fd);
                }}
              />
              {expandedId === issue.id && <div className="mt-2"><CommentThreadPanel comments={issue.comments || []} vas={vas} currentUserName={currentUserName} hiddenFields={{ issueId: issue.id }} addComment={addIssueComment} editComment={editIssueComment} removeComment={removeIssueComment} /></div>}
            </div>
            <DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} />
          </div>
        ))}
      </div>
    </>
  );
}

/* Shared by Review Patient Information and Charting Questions -- same
   fields, same shape (school/name/link/note/reportedBy/status/comments),
   just two separate sections on the page for two separate purposes. */
function SchoolRecordTable({ issues, emptyMessage, currentUserName, currentIsAdmin, vas, expandIssueId, setIssueStatus, removeIssue, addIssueComment, editIssueComment, removeIssueComment, ackIssueComments }: TableProps & { emptyMessage: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(expandIssueId ?? null);
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  const reversed = [...issues].reverse();
  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border bg-card sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
              <th className="px-2 py-1">School</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Student Record</th>
              <th className="px-2 py-1">Note</th>
              <th className="px-2 py-1">Reported By</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Comments</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reversed.map((issue) => (
              <Fragment key={issue.id}>
                <tr className="border-b bg-record-background align-top">
                  <td className="px-2 py-1 whitespace-nowrap">{issue.school || "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{issue.studentName || "—"}</td>
                  <td className="px-2 py-1"><a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="text-primary underline">{issue.studentRecordLink}</a></td>
                  <td className="px-2 py-1">{issue.remarks || "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{issue.reportedBy}</td>
                  <td className="px-2 py-1"><StatusSelectField issue={issue} setIssueStatus={setIssueStatus} /></td>
                  <td className="px-2 py-1">
                    <CommentToggleButton
                      comments={issue.comments || []}
                      commentAckBy={issue.commentAckBy || []}
                      currentUserName={currentUserName}
                      expanded={expandedId === issue.id}
                      onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                      onAck={() => {
                        const fd = new FormData();
                        fd.set("issueId", issue.id);
                        ackIssueComments(fd);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1"><DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} /></td>
                </tr>
                {expandedId === issue.id && (
                  <tr className="border-b bg-record-background no-record-hover">
                    <td colSpan={8} className="p-2">
                      <CommentThreadPanel comments={issue.comments || []} vas={vas} currentUserName={currentUserName} hiddenFields={{ issueId: issue.id }} addComment={addIssueComment} editComment={editIssueComment} removeComment={removeIssueComment} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 sm:hidden">
        {reversed.map((issue) => (
          <div key={issue.id} className="space-y-2 rounded-md border bg-record-background p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">School</div>
                <div>{issue.school || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Name</div>
                <div>{issue.studentName || "—"}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Student Record</div>
              <a href={issue.studentRecordLink} target="_blank" rel="noreferrer" className="break-all text-primary underline">{issue.studentRecordLink}</a>
            </div>
            {issue.remarks && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Note</div>
                <div>{issue.remarks}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Reported By</div>
              <div>{issue.reportedBy}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Status</div>
              <StatusSelectField issue={issue} setIssueStatus={setIssueStatus} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Comments</div>
              <CommentToggleButton
                comments={issue.comments || []}
                commentAckBy={issue.commentAckBy || []}
                currentUserName={currentUserName}
                expanded={expandedId === issue.id}
                onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                onAck={() => {
                  const fd = new FormData();
                  fd.set("issueId", issue.id);
                  ackIssueComments(fd);
                }}
              />
              {expandedId === issue.id && <div className="mt-2"><CommentThreadPanel comments={issue.comments || []} vas={vas} currentUserName={currentUserName} hiddenFields={{ issueId: issue.id }} addComment={addIssueComment} editComment={editIssueComment} removeComment={removeIssueComment} /></div>}
            </div>
            <DeleteIssueButton issue={issue} currentUserName={currentUserName} currentIsAdmin={currentIsAdmin} removeIssue={removeIssue} />
          </div>
        ))}
      </div>
    </>
  );
}

export function CorrectionTable(props: TableProps) {
  return <SchoolRecordTable {...props} emptyMessage="No Review Patient Information entries." />;
}

export function ChartingTable(props: TableProps) {
  return <SchoolRecordTable {...props} emptyMessage="No Charting Questions entries." />;
}
