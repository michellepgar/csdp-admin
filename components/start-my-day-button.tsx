"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

/* Pauses everything this VA has In Progress and drops it off Today
   until they pick it back up from Your Plan -- see startMyDay's own
   comment in app/(app)/overview/actions.ts for the full mechanics. A
   VA with nothing In Progress gets a silent no-op, so there's nothing
   to show on success; only a real error surfaces. */
export function StartMyDayButton({ startMyDay, disabled, disabledReason }: { startMyDay: () => Promise<{ error: string | null }>; disabled?: boolean; disabledReason?: string }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async () => {
        setError(null);
        const result = await startMyDay();
        if (result.error) setError(result.error);
      }}
    >
      <SubmitButton variant="plan" size="sm" pendingLabel="Starting…" disabled={disabled} title={disabled ? disabledReason : undefined}>Start my day</SubmitButton>
      {error && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
