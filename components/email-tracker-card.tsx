"use client";

import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { EMAIL_STATUS_OPTIONS, type EmailTrackerItem } from "@/lib/app-state";

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
  const openCount = items.filter((e) => e.status !== "Done").length;
  const sorted = [...items].reverse();

  return (
    <div className="rounded-md border">
      <div className="border-b p-3">
        <h2 className="font-semibold">
          Email Tracker {openCount > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{openCount}</span>}
        </h2>
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
              {canEdit && (
                <form action={removeEmailItem}>
                  <input type="hidden" name="schoolId" value={schoolId} />
                  <input type="hidden" name="itemId" value={e.id} />
                  <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
