"use client";

import { useEffect, useRef, useState } from "react";

/* A colored status picker that looks like a <select> but isn't one --
   native <option> popups turned out to not reliably take CSS styling
   in dark mode across browsers (three separate attempts at fixing the
   native version still left it unreadable except on hover), so this
   is a fully custom-built dropdown instead: our own div/button markup
   for the open list, styled with normal Tailwind classes that behave
   exactly the same in every browser and theme, no native popup
   involved at all.

   Submits through its own <form> (not AutoSubmitForm -- there's no
   native <select> "change" event to hook here) via a hidden input,
   calling requestSubmit() the moment an option is chosen. */
export function StatusSelect({
  action,
  hiddenFields,
  value,
  options,
  toneClassName,
  optionToneClassName,
  disabled,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string>;
  value: string;
  options: { value: string; label: string }[];
  /** Classes for the closed button, reflecting the CURRENT value's color. */
  toneClassName: string;
  /** Given an option's value, the classes for that option's row in the open list. */
  optionToneClassName: (value: string) => string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function choose(v: string) {
    setOpen(false);
    if (v === value) return;
    if (inputRef.current) inputRef.current.value = v;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="inline-block">
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input ref={inputRef} type="hidden" name="status" defaultValue={value} />
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`rounded-md border px-1.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${toneClassName}`}
        >
          {current?.label ?? value ?? "—"}
        </button>
        {open && !disabled && (
          <div className="absolute top-full left-0 z-20 mt-1 min-w-full overflow-hidden rounded-md border bg-background shadow-lg">
            {options.map((o) => (
              <button
                key={o.value || "none"}
                type="button"
                onClick={() => choose(o.value)}
                className={`block w-full px-2 py-1 text-left text-xs font-medium whitespace-nowrap ${optionToneClassName(o.value)}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
