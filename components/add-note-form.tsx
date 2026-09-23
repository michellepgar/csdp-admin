"use client";

import { useRef, useState } from "react";
import { StickyNoteComposer, type StickyNoteComposerHandle } from "@/components/sticky-note-composer";
import { SubmitButton } from "@/components/submit-button";
import type { Va } from "@/lib/app-state";

/* Shared by the two "Add a note" forms (app/(app)/notes/page.tsx,
   app/(app)/private-notes/page.tsx) -- each page still owns its own
   extra fields (General Notes' "Urgent" checkbox, Private Notes'
   "Mark as reminder"/"Also add to Your Plan") as children, rendered
   next to the submit button same as before. What this wraps is just
   the intercepted submit: the composer only clears itself once the
   Server Action confirms success, not on the raw browser submit event
   (see StickyNoteComposerHandle's own comment). */
export function AddNoteForm({
  action,
  placeholder,
  draftKey,
  vas,
  submitLabel = "Add note",
  pendingLabel = "Adding…",
  children,
}: {
  action: (formData: FormData) => Promise<{ error: string | null }>;
  placeholder: string;
  draftKey: string;
  vas: Va[];
  submitLabel?: string;
  pendingLabel?: string;
  children?: React.ReactNode;
}) {
  const composerRef = useRef<StickyNoteComposerHandle>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await action(formData);
        if (result.error) { setError(result.error); return; }
        composerRef.current?.reset();
      }}
      className="max-w-3xl space-y-2"
    >
      <StickyNoteComposer ref={composerRef} placeholder={placeholder} draftKey={draftKey} vas={vas} />
      <div className="flex items-center justify-between">
        {children}
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
      {error && <p role="alert" className="text-sm text-status-danger-foreground">{error}</p>}
    </form>
  );
}
