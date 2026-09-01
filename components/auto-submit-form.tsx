"use client";

import { useFormStatus } from "react-dom";

function PendingIndicator() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>;
}

/* Wraps a <form> bound to a Server Action so any input inside it submits
   the moment it changes — matches the HTML app's "edit and it saves"
   feel for things like the color picker and email field, without any
   hand-rolled client-side fetch/state management.

   Also shows a "Saving…" indicator while the action is in flight — a
   Server Action round-trip (auth check, fetch, write, then a full page
   revalidate) easily takes a second or two, and with zero feedback that
   silence reads as "broken" rather than "working." */
export function AutoSubmitForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      {children}
      <PendingIndicator />
    </form>
  );
}
