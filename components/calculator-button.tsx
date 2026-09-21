"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

/* A small "add these up for me" helper that sits next to a numeric
   input -- Michelle's team sometimes has several separate counts to
   combine (papers counted from different stacks/folders, say) before
   typing one final total into a field. Click the icon, type an
   expression (anything with digits and + works, e.g. "10+15+20"),
   press Enter -- like a real calculator's "=" -- and the total is
   written straight into the paired input and the popover closes. "Use
   total" does the same thing for a mouse-only click.

   Takes the input's own ref rather than a value+onChange pair so it
   drops onto any of this page's existing plain (uncontrolled) number
   inputs unchanged -- same reasoning Dropdown's hidden input uses for
   writing a DOM value directly: no re-render needed, and the value is
   still exactly what FormData reads at submit time. Same open/close-
   on-outside-click pattern as Dropdown, too. */
export function CalculatorButton({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    // Floats over the page, so close it if the page moves underneath.
    function onMove(e: Event) {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
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

  // Sits under the icon (above it when there's no room), outside the table's
  // layout so a scrolling or clipping parent can't cut it off.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const below = window.innerHeight - rect.bottom - 14;
    const top = below >= height ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height);
    popover.style.top = `${top}px`;
    popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    popover.style.visibility = "visible";
  }, [open]);

  const numbers = text.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const total = numbers.reduce((sum, n) => sum + n, 0);

  function applyTotal() {
    if (inputRef.current) {
      inputRef.current.value = numbers.length ? String(total) : "";
      // Setting .value directly (like this, or via a ref anywhere
      // else in this app) never fires a native "input" event -- only
      // real typing does. Distribution List's Number of Consent
      // Packets total listens for exactly that event to recompute
      // live, so it would silently miss a value applied this way
      // without dispatching one ourselves.
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setOpen(false);
    setText("");
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Add up several numbers"
        aria-label="Add up several numbers"
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ring/10 hover:text-ring aria-expanded:bg-ring/15 aria-expanded:text-ring"
        aria-expanded={open}
      >
        <Calculator className="h-4 w-4" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="z-[95] w-56 space-y-2.5 rounded-xl border border-ring/25 bg-background p-2.5 shadow-xl ring-1 ring-black/5"
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter behaves like a calculator's "=" -- compute and
              // commit immediately, don't wait for a button click.
              if (e.key === "Enter") {
                e.preventDefault();
                applyTotal();
              }
            }}
            placeholder="10+15+20, then Enter"
            className="h-8 w-full rounded-lg border px-2.5 text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              Total: <span className="font-semibold tabular-nums">{total}</span>
            </span>
            <Button type="button" size="xs" onClick={applyTotal}>
              Use total
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
