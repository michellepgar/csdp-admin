"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "@/components/submit-button";

/* A SubmitButton that asks for confirmation before its form submits --
   used app-wide for every delete/remove action (Suggestions, Contacts
   rows, Distribution rows, Tasks, Notes, etc.). Always forces the
   Button component's own "destructive" (red) variant, ignoring
   whatever variant a caller passes -- Michelle asked for every
   delete/remove button to read as red, and every one of them already
   goes through this one shared component, so this is the one place
   that makes that true everywhere at once instead of updating each
   of the 15+ call sites individually. */
export function ConfirmDeleteButton({
  confirmMessage,
  variant: _variant,
  ...props
}: ComponentProps<typeof SubmitButton> & { confirmMessage: string }) {
  return (
    <SubmitButton
      {...props}
      variant="destructive"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    />
  );
}
