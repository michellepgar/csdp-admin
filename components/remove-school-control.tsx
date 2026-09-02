"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

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
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Remove school
      </Button>
    );
  }

  return (
    <form action={removeSchool} className="flex flex-col items-end gap-2 rounded-md border p-2 text-sm">
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
