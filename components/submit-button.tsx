"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/* Swaps its own label to a pending state and disables itself while its
   parent form's Server Action is in flight — same reasoning as
   AutoSubmitForm's "Saving…" indicator, just for a plain submit button
   on a one-time-action form (Add/Remove, not autosave-on-change). */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
}: {
  children: React.ReactNode;
  pendingLabel: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
