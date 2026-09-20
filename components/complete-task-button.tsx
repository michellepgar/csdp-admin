"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { completeWorkItem } from "@/app/(app)/overview/actions";

/* One-click "this is done" check on YOUR OWN task in Currently Working On.
   Sets the real task to Completed, so the school page (or General Tasks)
   shows the same status without opening it. */
export function CompleteTaskButton({ itemKey, label }: { itemKey: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const data = new FormData();
            data.set("itemKey", itemKey);
            const result = await completeWorkItem(data);
            if (result.error) setError(result.error);
          })
        }
        aria-label={`Mark "${label}" as completed`}
        title="Mark as completed"
        className="flex h-5 w-5 flex-none items-center justify-center rounded border border-emerald-500/40 text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white disabled:opacity-60 dark:text-emerald-400"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      {error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </>
  );
}
