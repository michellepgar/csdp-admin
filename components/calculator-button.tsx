"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator } from "lucide-react";

/* A small "add these up for me" helper that sits next to a numeric
   input -- Michelle's team sometimes has several separate counts to
   combine (papers counted from different stacks/folders, say) before
   typing one final total into a field. Click the icon, type or paste
   the numbers (anything with digits works: one per line, +'d
   together, comma-separated), see the running sum, then "Use total"
   writes it straight into the paired input.

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

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const numbers = text.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const total = numbers.reduce((sum, n) => sum + n, 0);

  function useTotal() {
    if (inputRef.current) inputRef.current.value = numbers.length ? String(total) : "";
    setOpen(false);
    setText("");
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Add up several numbers"
        aria-label="Add up several numbers"
        className="text-muted-foreground hover:text-primary"
      >
        <Calculator className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-56 space-y-2 rounded-md border bg-background p-2 shadow-lg">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Type or paste numbers,\none per line or +'d together"}
            rows={3}
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              Total: <span className="font-semibold tabular-nums">{total}</span>
            </span>
            <Button useTotal={useTotal} />
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny inline button, not the shared Button component -- this popover
// is deliberately compact and this is its only control.
function Button({ useTotal }: { useTotal: () => void }) {
  return (
    <button
      type="button"
      onClick={useTotal}
      className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80"
    >
      Use total
    </button>
  );
}
