"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    // The list floats over the page at a fixed spot, so if the page scrolls or
    // resizes behind it, close it rather than leave it hanging in the wrong
    // place. (Scrolling the list itself is fine.)
    function onMove(e: Event) {
      if (e.target instanceof Node && listRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  // Place the floating list under the trigger (or above it when there isn't
  // room), as wide as the trigger at least, and never taller than the space
  // available. It lives outside the page's layout, so a parent with
  // overflow-hidden (a card, a column) can never clip it.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const EDGE = 8;
    const GAP = 6;
    list.style.minWidth = `${rect.width}px`;
    list.style.maxHeight = "16rem";
    const width = list.offsetWidth;
    const naturalHeight = list.scrollHeight;
    const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;
    const goUp = openUpward ? roomAbove >= Math.min(naturalHeight, 160) || roomAbove > roomBelow : roomBelow < Math.min(naturalHeight, 160) && roomAbove > roomBelow;
    const room = Math.max(96, goUp ? roomAbove : roomBelow);
    list.style.maxHeight = `${Math.min(256, room)}px`;
    const height = Math.min(list.offsetHeight, room);
    const top = goUp ? rect.top - GAP - height : rect.bottom + GAP;
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE));
    list.style.top = `${Math.max(EDGE, top)}px`;
    list.style.left = `${left}px`;
    list.style.visibility = "visible";
  }, [open, query, openUpward]);

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
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className={cn(
          // Raised, softly tinted field with a chevron -- not a flat box.
          "group flex w-full items-center justify-between gap-2 rounded-lg border border-ring/40 bg-linear-to-b from-card to-ring/5 px-2.5 py-1.5 text-left text-sm text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(0_0_0/0.08)] transition-all hover:border-ring hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_3px_8px_-3px_rgb(0_0_0/0.22)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:from-input/40 dark:to-input/20 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4)]",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !currentOption && "text-muted-foreground")}>{currentOption?.label ?? placeholder ?? current ?? "—"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ring/70 transition-transform group-hover:text-ring", open && "rotate-180")} aria-hidden />
      </button>
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div
          ref={listRef}
          role="listbox"
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="z-[95] w-max max-w-[min(24rem,85vw)] overflow-x-hidden overflow-y-auto rounded-xl border border-ring/25 bg-background p-1 shadow-xl ring-1 ring-black/5"
        >
          {searchable && (
            <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 border-b bg-background p-1.5">
              <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
                className="h-8 w-full rounded-lg border border-ring/30 bg-card pl-8 pr-2 text-sm shadow-inner outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              </div>
            </div>
          )}
          {searchable && needle && matchingOptions.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>}
          {visibleOptions.map((o) => {
            const selected = o.value === current && o.value !== "";
            return (
              <button
                key={o.value || "none"}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-ring/10",
                  selected && "bg-ring/10 font-medium text-ring",
                )}
              >
                <span className="min-w-0 break-words">{o.label}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
