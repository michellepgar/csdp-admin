"use client";

import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { DeleteOrRequestControl } from "@/components/delete-or-request-control";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { EMAIL_STATUS_OPTIONS, type EmailTrackerItem } from "@/lib/app-state";

/* Mirrors TASK_STATUS_TONE in tasks-card.tsx: same three-color scheme
   (warning/paused/success) applied to the equivalent email statuses. */
const EMAIL_STATUS_TONE: Record<string, StatusTone> = {
  "Needs My Response": "warning",
  "Waiting on Them": "paused",
  Done: "success",
};

export function EmailTrackerCard({
  schoolId,
  items,
  canEdit,
  pendingRemovalRequestIds,
  addEmailItem,
  setEmailStatus,
  removeEmailItem,
  requestRemoval,
}: {
  schoolId: string;
  items: EmailTrackerItem[];
  canEdit: boolean;
  pendingRemovalRequestIds: string[];
  addEmailItem: (formData: FormData) => void;
  setEmailStatus: (formData: FormData) => void;
  removeEmailItem: (formData: FormData) => void;
  requestRemoval: (formData: FormData) => void;
}) {
  const openCount = items.filter((e) => e.status !== "Done").length;
  const sorted = [...items].reverse();
  const pendingSet = new Set(pendingRemovalRequestIds);
  const needsResponseCount = items.filter((e) => e.status === "Needs My Response").length;
  const waitingCount = items.filter((e) => e.status === "Waiting on Them").length;
  const doneCount = items.filter((e) => e.status === "Done").length;

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b p-3">
        <h2 className="font-semibold">
          Email Tracker {openCount > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{openCount}</span>}
        </h2>
        <StatusBadge tone="warning">{needsResponseCount}</StatusBadge>
        <StatusBadge tone="paused">{waitingCount}</StatusBadge>
        <StatusBadge tone="success">{doneCount}</StatusBadge>
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

        {sorted.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <span className="text-sm">{e.description}</span>
            <div className="flex flex-none items-center gap-2">
              <StatusBadge tone={EMAIL_STATUS_TONE[e.status] ?? "neutral"}>{e.status || "—"}</StatusBadge>
              <AutoSubmitForm action={setEmailStatus}>
                <input type="hidden" name="schoolId" value={schoolId} />
                <input type="hidden" name="itemId" value={e.id} />
                <select
                  key={e.status}
                  name="status"
                  defaultValue={e.status}
                  disabled={!canEdit}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  {EMAIL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </AutoSubmitForm>
              <DeleteOrRequestControl
                canDelete={canEdit}
                hasPendingRequest={pendingSet.has(e.id)}
                recordKind="email-item"
                idFieldName="itemId"
                schoolId={schoolId}
                targetId={e.id}
                label={`email "${e.description}"`}
                removeAction={removeEmailItem}
                requestAction={requestRemoval}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
