"use client";

import { useTransition } from "react";
import { Loader2, Square } from "lucide-react";
import { endMeeting } from "@/app/(app)/overview/actions";

/* "End meeting" on your own running meeting in Currently Working On (the
   same as ending it from Your Plan). itemKey is the meeting's "p:<id>". */
export function EndMeetingButton({ itemKey }: { itemKey: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="End meeting"
      aria-label="End meeting"
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("id", itemKey.replace(/^p:/, ""));
          await endMeeting(formData);
        })
      }
      className="inline-flex h-6 items-center gap-1 rounded-md border border-violet-400/60 px-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />} End
    </button>
  );
}
