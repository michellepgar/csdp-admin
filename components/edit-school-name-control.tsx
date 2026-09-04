"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoverLabel } from "@/components/hover-label";

/* The school page is the only place a school's name can be edited --
   renaming here also rewrites its matching Contacts and Distribution
   List rows (see renameSchool's own comment in
   app/(app)/schools/[id]/actions.ts), which is exactly why nowhere
   else in the app offers a school-name edit of its own; a rename typed
   somewhere that only touched one table would silently orphan the
   other two. */
export function EditSchoolNameControl({
  schoolId,
  schoolName,
  renameSchool,
}: {
  schoolId: string;
  schoolName: string;
  renameSchool: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <HoverLabel label="Edit name" side="left">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => setEditing(true)} aria-label="Edit name">
          <Pencil className="h-4 w-4" />
        </Button>
      </HoverLabel>
    );
  }

  return (
    // bg-background (not transparent) -- same reasoning as
    // RemoveSchoolControl's own confirm panel: this sits on the
    // school page's bold teal title row, where unstyled text would
    // render directly on that background instead of a neutral surface.
    <form
      action={renameSchool}
      onSubmit={() => setEditing(false)}
      className="flex items-center gap-2 rounded-md border bg-background p-2"
    >
      <input type="hidden" name="schoolId" value={schoolId} />
      <Input name="name" defaultValue={schoolName} autoFocus required className="w-48" />
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </form>
  );
}
