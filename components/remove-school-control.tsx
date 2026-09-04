"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { HoverLabel } from "@/components/hover-label";

/* Clicking "Remove school" doesn't delete right away -- it reveals an
   explicit choice, since removing a school has a real question
   attached: keep its Contacts/Distribution List entries (matched by
   name, not linked automatically) or remove those too. A plain
   confirm() can't offer a three-way choice, so this is a small inline
   panel instead. */
export function RemoveSchoolControl({
  schoolId,
  schoolName,
  removeSchool,
  removeSchoolAndContacts,
}: {
  schoolId: string;
  schoolName: string;
  removeSchool: (formData: FormData) => void;
  removeSchoolAndContacts: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      // bg-background + border (light mode only -- dark mode's own
      // dark:bg-destructive/20 from the variant itself already reads
      // fine, confirmed directly) -- this button sits on the school
      // page's bright light-mode teal header, where the destructive
      // variant's own barely-there bg-destructive/10 all but
      // disappeared into it (Michelle circled this exact spot as
      // unreadable). An opaque pill behind the icon gives it a
      // consistent, readable backdrop regardless of the header color.
      <HoverLabel label="Remove school" side="left">
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          onClick={() => setConfirming(true)}
          aria-label="Remove school"
          className="border border-destructive/40 bg-background shadow-sm"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </HoverLabel>
    );
  }

  return (
    // bg-background (not transparent) -- this panel sits on the
    // school page's bg-header-background title row, which is now a
    // bold teal (see app/globals.css); without its own opaque
    // background, this panel's own muted-foreground text would render
    // directly on that teal instead of a neutral surface.
    <form action={removeSchool} className="flex flex-col items-end gap-2 rounded-md border bg-background p-2 text-sm">
      <input type="hidden" name="schoolId" value={schoolId} />
      <p className="text-right text-xs text-muted-foreground">
        Also remove {schoolName}&apos;s entries on Contacts and Distribution List?
      </p>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <SubmitButton formAction={removeSchool} pendingLabel="Removing…" variant="outline" size="sm">
          Keep them
        </SubmitButton>
        <SubmitButton formAction={removeSchoolAndContacts} pendingLabel="Removing…" variant="destructive" size="sm">
          Delete them too
        </SubmitButton>
      </div>
    </form>
  );
}
