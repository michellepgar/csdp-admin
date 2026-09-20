"use client";

import { useEffect, useRef, useState } from "react";

/* A list longer than this gets a search box, so a long one (every school,
   say) can be filtered by typing a few letters instead of scrolled. */
const SEARCH_THRESHOLD = 7;

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
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

  // Focus the search box as soon as the list opens, so typing just works.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const searchable = options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  // "+ Add new ..." style entries are actions, not results, so they stay visible.
  const visibleOptions = searchable && needle
    ? options.filter((o) => o.label.trim().startsWith("+") || o.label.toLowerCase().includes(needle))
    : options;
  const matchingOptions = visibleOptions.filter((o) => !o.label.trim().startsWith("+"));

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
    setQuery("");
    onChange?.(v);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <input ref={inputRef} type="hidden" name={name} defaultValue={current} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className={className ?? "w-full rounded-md border bg-background px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"}
      >
        {currentOption?.label ?? placeholder ?? current ?? "—"}
      </button>
      {open && !disabled && (
        <div className={`absolute left-0 z-20 max-h-64 min-w-full overflow-y-auto rounded-md border bg-background shadow-lg ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {searchable && (
            <div className="sticky top-0 border-b bg-background p-1.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (matchingOptions[0]) choose(matchingOptions[0].value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Type to search…"
                aria-label="Search options"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          {searchable && needle && matchingOptions.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>}
          {visibleOptions.map((o) => (
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
