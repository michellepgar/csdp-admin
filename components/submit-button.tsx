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
}: {
  children: React.ReactNode;
  pendingLabel: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} variant={variant} size={size} title={title}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
