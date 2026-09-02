"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/* Swaps its own label to a pending state and disables itself while its
   parent form's Server Action is in flight — same reasoning as
   AutoSubmitForm's "Saving…" indicator, just for a plain submit button
   on a one-time-action form (Add/Remove, not autosave-on-change).
   `disabled` lets a caller also disable it for a permission reason
   (e.g. "only the assigned VA can check this off") — the server action
   re-checks the same permission regardless, this is just so the button
   doesn't silently no-op with no visible explanation. */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  disabled,
  title,
  formAction,
  onClick,
}: {
  children: React.ReactNode;
  pendingLabel: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  title?: string;
  /* Overrides the enclosing form's Server Action for just this button —
     use this instead of nesting a second <form> inside the row's form
     (e.g. a per-row "Remove" button next to "Done"). HTML doesn't allow
     nested <form> elements: browsers parse-error and drop the inner
     form tag, silently flattening its button into the outer form, so a
     "Remove" button inside a nested form actually submits the outer
     form's action instead of its own. */
  formAction?: (formData: FormData) => void;
  /* Lets a caller intercept the click before submission -- e.g.
     ConfirmDeleteButton uses this to call preventDefault() when the
     user declines a confirmation prompt. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      formAction={formAction}
      onClick={onClick}
      disabled={pending || disabled}
      variant={variant}
      size={size}
      title={title}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
