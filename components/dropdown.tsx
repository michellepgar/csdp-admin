"use client";

import { useEffect, useRef, useState } from "react";

/* A drop-in replacement for a plain <select> -- same job (pick one of
   a few options, participates in a surrounding <form> via a hidden
   input with the given `name`), but built from our own div/button
   markup instead of a native popup. Native <select> popups have
   proven unreliable in dark mode across browsers/devices (confirmed
   directly: even a plain, unstyled select showed a native light popup
   regardless of color-scheme: dark being set) -- this sidesteps that
   entirely by never using a native popup in the first place.

   Uncontrolled by default (like a plain <select defaultValue>) --
   pass `value` instead of `defaultValue` only if the caller needs to
   force-update it after a re-render (see the `key` prop pattern used
   elsewhere in this app for that). */
export function Dropdown({
  name,
  defaultValue,
  value,
  options,
  placeholder,
  disabled,
  required,
  className,
  onChange,
  openUpward,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  /** Opens the option list above the trigger instead of below it -- for
   *  callers rendered near the bottom of the viewport (e.g. inside the
   *  floating plan bubble), where the default downward list gets
   *  clipped by the window edge. */
  openUpward?: boolean;
}) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = value ?? internalValue;
  const currentOption = options.find((o) => o.value === current);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Controlled callers can replace the selected value after mount.
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  // Keep the (uncontrolled) hidden input's actual DOM value in sync
  // whenever `current` changes for any reason other than choose()
  // itself (which already writes it directly) -- e.g. a controlled
  // caller passing a new `value` prop from its own state.
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== current) inputRef.current.value = current;
  }, [current]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function choose(v: string) {
    // Write the hidden input's DOM value directly (not just React
    // state) before calling onChange -- a caller's onChange often
    // calls form.requestSubmit() synchronously right here (see
    // AutoSubmitDropdown), which reads whatever's actually in the DOM
    // at that instant. React's state-driven re-render of a
    // value={current}-controlled input hasn't committed yet at this
    // point in the same event handler, so relying on it alone
    // submitted the PREVIOUS value instead of the one just clicked
    // (caught by direct testing, not theoretical).
    if (inputRef.current) inputRef.current.value = v;
    setInternalValue(v);
    setOpen(false);
    onChange?.(v);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <input ref={inputRef} type="hidden" name={name} defaultValue={current} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={className ?? "w-full rounded-md border bg-background px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"}
      >
        {currentOption?.label ?? placeholder ?? current ?? "—"}
      </button>
      {open && !disabled && (
        <div className={`absolute left-0 z-20 max-h-64 min-w-full overflow-y-auto rounded-md border bg-background shadow-lg ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {options.map((o) => (
            <button
              key={o.value || "none"}
              type="button"
              onClick={() => choose(o.value)}
              className="block w-full px-2 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
