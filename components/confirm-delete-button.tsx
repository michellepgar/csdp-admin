"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "@/components/submit-button";

/* A SubmitButton that asks for confirmation before its form submits.
   Scoped to the new school-contacts list editors only -- retrofitting
   this onto every other existing delete button in the app (Suggestions,
   Contacts rows, Distribution rows, Tasks, etc.) is real, separate,
   larger work tracked as a follow-up, not done here. */
export function ConfirmDeleteButton({
  confirmMessage,
  ...props
}: ComponentProps<typeof SubmitButton> & { confirmMessage: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    />
  );
}
