"use client";

import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/* Remove a team member -- removeVa itself clears their name off anything not
   yet Completed (see its own comment), so the confirm message says that up
   front. Still shown via {error}, not a thrown exception (which gets
   redacted to a generic message in production), in case the remove itself
   genuinely fails partway through. */
export function RemoveVaButton({ id, name, removeVa }: {
  id: string;
  name: string;
  removeVa: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <form
        action={async (formData) => {
          setError(null);
          const result = await removeVa(formData);
          if (result.error) setError(result.error);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <ConfirmDeleteButton confirmMessage={`Remove ${name} from the team? Their name will be cleared from anything of theirs that isn't done yet -- completed work keeps their name.`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
      </form>
      {error && <p role="alert" className="max-w-56 text-right text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
