"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, MoreVertical } from "lucide-react";

export interface KebabMenuItem {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  /** Instead of running an action, open this panel in place of the menu (e.g. a list of people to choose from). `close` shuts the whole menu. */
  panel?: (close: () => void) => React.ReactNode;
}

const GAP = 4;
const EDGE = 8;

/* The menu floats above the page (fixed, in a portal) instead of sitting
   inside its table cell, so opening it never stretches the table or adds
   a scrollbar to it. It opens below the button when there's room and flips
   above when there isn't, and slides sideways to stay on screen. */
export function KebabMenu({
  items = [],
  ariaLabel,
  icon,
  title,
  active = false,
  disabled = false,
  content,
}: {
  items?: KebabMenuItem[];
  ariaLabel: string;
  /** Replaces the three-dots icon (e.g. a filter or color button). */
  icon?: React.ReactNode;
  title?: string;
  /** Shows the button as "on" (e.g. a column with a filter applied). */
  active?: boolean;
  disabled?: boolean;
  /** Opens straight into this panel instead of a list of items. `close` shuts it. */
  content?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [panelItem, setPanelItem] = useState<KebabMenuItem | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setPanelItem(null);
  }

  // Position after every render that changes what's inside (menu <-> panel).
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;
    let top: number;
    if (height <= roomBelow || roomBelow >= roomAbove) top = rect.bottom + GAP;
    else top = rect.top - GAP - height;
    top = Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    const left = Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE));
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.visibility = "visible";
  }, [open, panelItem]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    // The page scrolling or resizing would leave the menu floating in the wrong place
    // (scrolling a long list inside the menu itself is fine).
    function onMove(e: Event) {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
      close();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (open) close(); else setOpen(true); }}
        // Keeps the keyboard focus (and a table's selected cells) where it was.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={ariaLabel}
        aria-expanded={open}
        title={title}
        disabled={disabled}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-ring/10 hover:text-ring aria-expanded:bg-ring/15 aria-expanded:text-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${active ? "bg-ring/15 text-ring" : "text-muted-foreground"}`}
      >
        {icon ?? <MoreVertical className="h-4 w-4" />}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="z-[70] max-h-[calc(100vh-1rem)] min-w-40 max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-ring/25 bg-background p-1 shadow-xl ring-1 ring-black/5"
        >
          {content ? (
            <div className="p-2">{content(close)}</div>
          ) : panelItem?.panel ? (
            <div className="p-2">
              <button type="button" onClick={() => setPanelItem(null)} className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              {panelItem.panel(close)}
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.panel) { setPanelItem(item); return; }
                  item.onClick?.();
                  close();
                }}
                className={`block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-ring/10"}`}
              >
                {item.label}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* The same menu, opened at a point on screen instead of from a button -- for a
   right-click. It stays on screen near the edges and closes on a click
   elsewhere, Escape, scrolling or resizing. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: KebabMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const left = Math.max(EDGE, Math.min(x, window.innerWidth - menu.offsetWidth - EDGE));
    const top = y + menu.offsetHeight + EDGE > window.innerHeight ? Math.max(EDGE, y - menu.offsetHeight) : y;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "visible";
  }, [x, y]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMove = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="z-[70] min-w-48 max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-ring/25 bg-background p-1 shadow-xl ring-1 ring-black/5"
    >
      {items.map((item, i) =>
        item.label === "—" ? (
          <div key={`sep-${i}`} className="my-1 h-px bg-border" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={`block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-ring/10"}`}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
