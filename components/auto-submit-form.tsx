"use client";

/* Wraps a <form> bound to a Server Action so any input inside it submits
   the moment it changes — matches the HTML app's "edit and it saves"
   feel for things like the color picker and email field, without any
   hand-rolled client-side fetch/state management. */
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
    </form>
  );
}
