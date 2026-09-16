"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "@/components/submit-button";

/* A SubmitButton that asks for confirmation before its form submits --
   used app-wide for every delete/remove action (Suggestions, Contacts
   rows, Distribution rows, Tasks, Notes, etc.). Always forces the
   Button component's own "destructive" (red) variant AND "icon-xs"
   size, ignoring whatever variant/size a caller passes -- Michelle
   asked for every delete/remove button to read as red and stay
   compact, and every one of them already goes through this one shared
   component, so this is the one place that makes that true everywhere
   at once instead of updating each of the 15+ call sites individually
   (many of which still pass their own old size="xs"/"sm" from before
   this was standardized -- those need to keep being silently ignored,
   not suddenly take effect).

   `iconSize` is a SEPARATE, deliberately-opt-in prop for the rare case
   that even icon-xs is too big -- Michelle asked for the
   remove-signature ✕ sitting right next to a small SignatureChip to
   be smaller (tasks-card.tsx passes "icon-2xs" there). Using a
   different prop name than `size` keeps every pre-existing call site
   (which passes its own ignored `size`) from suddenly picking this up
   by accident. */
export function ConfirmDeleteButton({
  confirmMessage,
  variant: _variant,
  size: _size,
  iconSize = "icon-xs",
  ...props
}: ComponentProps<typeof SubmitButton> & { confirmMessage: string; iconSize?: "icon-xs" | "icon-2xs" }) {
  void _variant;
  void _size;
  return (
    <SubmitButton
      {...props}
      variant="ghost"
      size={iconSize}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    ><span className="text-destructive">{props.children}</span></SubmitButton>
  );
}
