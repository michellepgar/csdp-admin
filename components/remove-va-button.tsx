"use client";

import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/* Remove a team member -- a plain <form action={removeVa}> couldn't show
   removeVa's own "still has open work" message (a Server Action that just
   throws gets redacted to a generic error in production; removeVa returns
   {error} instead specifically so this can show the real reason). */
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
        <ConfirmDeleteButton confirmMessage={`Remove ${name} from the team?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
      </form>
      {error && <p role="alert" className="max-w-56 text-right text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
