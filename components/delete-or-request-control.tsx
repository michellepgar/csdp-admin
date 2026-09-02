"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

/* The delete control always shows something — never just disappears
   when you're not allowed to delete a record outright. If you can,
   it's a normal ✕. If you can't, clicking it opens a reason field that
   sends a removal request to whoever manages the school instead
   (resolved on the Approvals page) — same "always offer a path, never
   a dead end" pattern as the rest of this app. */
export function DeleteOrRequestControl({
  canDelete,
  hasPendingRequest,
  recordKind,
  idFieldName,
  schoolId,
  targetId,
  label,
  removeAction,
  requestAction,
}: {
  canDelete: boolean;
  hasPendingRequest: boolean;
  recordKind: "task" | "email-item";
  idFieldName: "taskId" | "itemId";
  schoolId: string;
  targetId: string;
  label: string;
  removeAction: (formData: FormData) => void;
  requestAction: (formData: FormData) => void;
}) {
  const [requesting, setRequesting] = useState(false);

  if (canDelete) {
    return (
      <form action={removeAction}>
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name={idFieldName} value={targetId} />
        <SubmitButton pendingLabel="…" variant="ghost" size="xs">✕</SubmitButton>
      </form>
    );
  }

  if (hasPendingRequest) {
    return <span className="text-xs text-muted-foreground" title="Request pending — waiting on the assigned VA or an Admin/Owner">⏳</span>;
  }

  if (requesting) {
    return (
      <form action={requestAction} onSubmit={() => setRequesting(false)} className="flex items-center gap-1">
        <input type="hidden" name="recordKind" value={recordKind} />
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="label" value={label} />
        <input name="reason" placeholder="Reason for removing this" required className="w-40 rounded-md border px-2 py-1 text-xs" />
        <SubmitButton pendingLabel="…" size="xs">Send</SubmitButton>
        <button type="button" onClick={() => setRequesting(false)} className="text-xs text-muted-foreground underline">Cancel</button>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setRequesting(true)} className="text-muted-foreground hover:text-destructive" title="Request removal">
      ✕
    </button>
  );
}
