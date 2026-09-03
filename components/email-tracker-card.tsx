"use client";

import { SubmitButton } from "@/components/submit-button";
import { DeleteOrRequestControl } from "@/components/delete-or-request-control";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
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
  addEmailItem,
  setEmailStatus,
  removeEmailItem,
}: {
  schoolId: string;
  items: EmailTrackerItem[];
  canEdit: boolean;
  addEmailItem: (formData: FormData) => void;
  setEmailStatus: (formData: FormData) => void;
  removeEmailItem: (formData: FormData) => void;
}) {
  const sorted = [...items].reverse();

  return (
    <div id="email-tracker" className="scroll-mt-20 rounded-md border">
      <div className="flex items-center gap-2 border-b bg-title-background p-3">
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
              <div key={e.id} className="flex items-center justify-between gap-2 bg-record-background px-2 py-1">
                <span className="min-w-0 flex-1 text-sm">{e.description}</span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
