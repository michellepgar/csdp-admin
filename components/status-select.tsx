"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  // Screen position for the portaled option list below -- computed
  // fresh each time it opens (see the button's onClick) rather than
  // kept in sync continuously, since it only needs to be right at the
  // instant it appears.
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The open menu itself, so onClickOutside below can tell a click on
  // an OPTION apart from a real outside click -- createPortal renders
  // the menu into document.body, not inside containerRef's own DOM
  // subtree, even though it's written inside containerRef's JSX. That
  // meant containerRef.current.contains(e.target) was false for every
  // click on an option, so mousedown (which always fires before
  // click) closed the menu and unmounted the option out from under
  // the click that was supposed to choose it -- confirmed directly:
  // choosing a status silently did nothing for every real mouse click.
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    // Closes on any scroll (this row's own horizontally-scrolling table
    // included) rather than trying to keep the portaled menu's position
    // glued to the button as it scrolls out from under it -- simplest
    // correct behavior, and matches how a native <select>'s popup
    // disappears the moment its page scrolls.
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("scroll", onScroll, true);
    };
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
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            // Every place this renders lives inside a table wrapped in
            // overflow-x-auto (for the horizontal scroll wide tables
            // need) -- CSS forces overflow-y to clip right along with
            // overflow-x on the same element, so the old plain
            // position:absolute menu got cut off/overlapped by that
            // container the moment it dropped below the row's own
            // bottom edge (confirmed directly: Michelle's screenshot
            // showed exactly that). Portaling to document.body with a
            // fixed position computed from the button's own real
            // screen position sidesteps the clipping entirely.
            const rect = buttonRef.current?.getBoundingClientRect();
            if (rect) setMenuPos({ top: rect.bottom, left: rect.left, minWidth: rect.width });
            setOpen((o) => !o);
          }}
          className={`rounded-md border px-1.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${toneClassName}`}
        >
          {current?.label ?? value ?? "—"}
        </button>
        {open && !disabled && createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 mt-1 overflow-hidden rounded-md border bg-background shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.minWidth }}
          >
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
          </div>,
          document.body
        )}
      </div>
    </form>
  );
}
