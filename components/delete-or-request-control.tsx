"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/* A confirm-before-delete control for a Task or Email Tracker item.
   Only the assigned VA (or an Admin/Owner) can delete -- shown
   disabled with an explanatory tooltip otherwise (ask them, or an
   Admin/Owner, to remove it) rather than offering a request-for-
   approval flow, now that the Approvals page (where such requests
   used to be resolved) has been removed.

   `icon` defaults to the plain ✕ every other delete button in this
   app uses; tasks-card.tsx passes a small Trash2 instead for removing
   a whole file row -- Michelle asked for that one specifically to
   look visually distinct from the many other ✕ buttons already
   sitting in the same row (removing one signature, one category
   assignment), since it's the one that deletes everything at once. */
export function DeleteOrRequestControl({
  canDelete,
  schoolId,
  idFieldName,
  targetId,
  label,
  removeAction,
  icon = "✕",
}: {
  canDelete: boolean;
  schoolId: string;
  idFieldName: "taskId" | "taskFileId" | "itemId";
  targetId: string;
  label: string;
  removeAction: (formData: FormData) => void;
  icon?: React.ReactNode;
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
        {icon}
      </ConfirmDeleteButton>
    </form>
  );
}
