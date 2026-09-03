"use client";

import { useRef } from "react";
import { Dropdown } from "@/components/dropdown";

/* A Dropdown (components/dropdown.tsx) wrapped in its own form,
   submitting the moment an option is picked -- the Dropdown
   equivalent of AutoSubmitForm, needed because Dropdown is custom
   div/button markup, not a native <select>, so there's no "change"
   event for AutoSubmitForm's onChange-triggers-requestSubmit() trick
   to listen for. Usable directly from a Server Component (all its
   props are plain serializable values plus a Server Action -- no
   client-side closures required of the caller). */
export function AutoSubmitDropdown({
  action,
  hiddenFields,
  name,
  value,
  defaultValue,
  options,
  placeholder,
  className,
}: {
  action: (formData: FormData) => void;
  hiddenFields?: Record<string, string>;
  name: string;
  value?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-block">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Dropdown
        name={name}
        value={value}
        defaultValue={defaultValue}
        options={options}
        placeholder={placeholder}
        className={className}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
