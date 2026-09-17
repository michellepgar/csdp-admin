"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteOrRequestControl } from "@/components/delete-or-request-control";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
import { submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
import { EMAIL_STATUS_OPTIONS, type EmailTrackerItem } from "@/lib/app-state";

/* Mirrors TASK_STATUS_TONE in tasks-card.tsx: same three-color scheme
   (warning/paused/success) applied to the equivalent email statuses. */
const EMAIL_STATUS_TONE: Record<string, StatusTone> = {
  "Needs My Response": "warning",
  "Waiting on Them": "paused",
  Done: "success",
};

function EmailTrackerRow({
  schoolId,
  item: e,
  canEdit,
  setEmailStatus,
  removeEmailItem,
  updateEmailItemDescription,
}: {
  schoolId: string;
  item: EmailTrackerItem;
  canEdit: boolean;
  setEmailStatus: (formData: FormData) => void;
  removeEmailItem: (formData: FormData) => void;
  updateEmailItemDescription: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(e.description);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <form
        action={(formData) => submitTaskFileForm(updateEmailItemDescription, formData, setError, () => setEditing(false))}
        className="flex flex-wrap items-center gap-1 bg-record-background px-2 py-1"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="itemId" value={e.id} />
        <Input name="description" value={description} onChange={(ev) => setDescription(ev.target.value)} required autoFocus className="h-7 min-w-0 flex-1" />
        <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton>
        <Button type="button" variant="ghost" size="xs" onClick={() => { setDescription(e.description); setError(null); setEditing(false); }}>Cancel</Button>
        {error && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-record-background px-2 py-1">
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? "Edit description" : undefined}
        className="min-w-0 flex-1 truncate text-left text-sm enabled:hover:underline"
      >
        {e.description}
      </button>
      <div className="flex flex-none items-center gap-2">
        <StatusSelect
          action={setEmailStatus}
          hiddenFields={{ schoolId, itemId: e.id }}
          value={e.status}
          options={EMAIL_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          toneClassName={TONE_CLASSES[EMAIL_STATUS_TONE[e.status] ?? "neutral"]}
          optionToneClassName={(v) => TONE_CLASSES[EMAIL_STATUS_TONE[v] ?? "neutral"]}
          disabled={!canEdit}
        />
        <DeleteOrRequestControl
          canDelete={canEdit}
          idFieldName="itemId"
          schoolId={schoolId}
          targetId={e.id}
          label={`email "${e.description}"`}
          removeAction={removeEmailItem}
        />
      </div>
    </div>
  );
}

export function EmailTrackerCard({
  schoolId,
  items,
  canEdit,
  addEmailItem,
  setEmailStatus,
  removeEmailItem,
  updateEmailItemDescription,
}: {
  schoolId: string;
  items: EmailTrackerItem[];
  canEdit: boolean;
  addEmailItem: (formData: FormData) => void;
  setEmailStatus: (formData: FormData) => void;
  removeEmailItem: (formData: FormData) => void;
  updateEmailItemDescription: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const sorted = [...items].reverse();

  return (
    <div id="email-tracker" className="scroll-mt-20 rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold">Email Tracker</h2>
      </div>
      <div className="space-y-3 p-3">
        {canEdit ? (
          <form action={addEmailItem} className="flex gap-2">
            <input type="hidden" name="schoolId" value={schoolId} />
            <Input name="description" placeholder="What's the email about?" required />
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">Only the assigned VA (or an Owner/Admin) can add to this school&apos;s Email Tracker.</p>
        )}

        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing being tracked — add an email that needs a response or a reply.</p>
        )}

        {sorted.length > 0 && (
          <div className="divide-y rounded-md border">
            {sorted.map((e) => (
              <EmailTrackerRow
                key={e.id}
                schoolId={schoolId}
                item={e}
                canEdit={canEdit}
                setEmailStatus={setEmailStatus}
                removeEmailItem={removeEmailItem}
                updateEmailItemDescription={updateEmailItemDescription}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
