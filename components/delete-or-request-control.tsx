"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/* A confirm-before-delete ✕ for a Task or Email Tracker item. Only the
   assigned VA (or an Admin/Owner) can delete -- shown disabled with an
   explanatory tooltip otherwise (ask them, or an Admin/Owner, to
   remove it) rather than offering a request-for-approval flow, now
   that the Approvals page (where such requests used to be resolved)
   has been removed. */
export function DeleteOrRequestControl({
  canDelete,
  schoolId,
  idFieldName,
  targetId,
  label,
  removeAction,
}: {
  canDelete: boolean;
  schoolId: string;
  idFieldName: "taskId" | "itemId";
  targetId: string;
  label: string;
  removeAction: (formData: FormData) => void;
}) {
  return (
    <form action={removeAction}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name={idFieldName} value={targetId} />
      <ConfirmDeleteButton
        confirmMessage={`Remove ${label}? This can't be undone.`}
        pendingLabel="…"
        variant="ghost"
        size="xs"
        disabled={!canDelete}
        title={canDelete ? undefined : "Only the assigned VA (or an Admin/Owner) can remove this"}
      >
        ✕
      </ConfirmDeleteButton>
    </form>
  );
}
