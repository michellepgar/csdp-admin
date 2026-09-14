"use client";

import { useEffect, useRef } from "react";
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
   silence reads as "broken" rather than "working."

   Listens for the real native "change" DOM event via a ref, NOT React's
   onChange prop -- React's onChange is actually wired to the native
   "input" event under the hood for every element (a deliberate
   normalization so text inputs report every keystroke reliably across
   browsers), and that includes bubbling up to an ancestor <form> with
   its own onChange. A native color picker fires "input" continuously
   while you're dragging inside it (confirmed directly: 5+ events for
   one color pick) but "change" only once, when you commit to a color --
   with the old onChange-prop version, every single one of those drag
   ticks fired a full Server Action round trip (auth check + write +
   revalidate + full page refetch), which is exactly why Michelle saw
   assigning a color take so long: it wasn't one slow save, it was
   dozens of them queued up back to back. Native "change" fixes this for
   every input type this wraps, not just color -- a checkbox already
   only ever fired one change per click anyway, and a text field now
   saves once you move on from it instead of on every keystroke, which
   is less wasted work, not a behavior regression. */
export function AutoSubmitForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function submitOnChange() {
      form?.requestSubmit();
    }
    form.addEventListener("change", submitOnChange);
    return () => form.removeEventListener("change", submitOnChange);
  }, []);

  return (
    <form ref={formRef} action={action} className={className}>
      {children}
      <PendingIndicator />
    </form>
  );
}
