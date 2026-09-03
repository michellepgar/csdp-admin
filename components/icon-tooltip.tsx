"use client";

import { cloneElement, useRef, useState, type ReactElement, type AnchorHTMLAttributes } from "react";
import { createPortal } from "react-dom";

/* A small, stylish hover label for the sidebar's icon-only mode
   (components/sidebar.tsx) -- a native `title` attribute already
   shows a tooltip, but it's slow to appear (~1s) and can't be
   styled, which is exactly what Michelle asked to improve.

   Portaled to <body> rather than positioned as a sibling of the icon:
   the sidebar's nav list scrolls internally via overflow-y-auto,
   and per the CSS overflow spec, setting overflow-y alone forces
   overflow-x to the same non-visible behavior -- so anything
   absolutely positioned past the nav's own right edge would get
   silently clipped. Fixed-positioning a portaled element sidesteps
   that entirely.

   No wrapper DOM node: `children` (always the one nav Link) gets its
   ref and hover/focus handlers cloned directly onto it, so this adds
   zero layout of its own -- just the floating label. `active` (tied
   to the sidebar's own collapsed state) turns all of this off when
   the link already shows its own visible text, where a second label
   saying the same thing would be redundant. */
export function IconTooltip({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactElement<AnchorHTMLAttributes<HTMLAnchorElement>>;
}) {
  const nodeRef = useRef<HTMLAnchorElement | null>(null);
  const [open, setOpen] = useState(false);

  if (!active) return children;

  const rect = open ? nodeRef.current?.getBoundingClientRect() : undefined;

  return (
    <>
      {cloneElement(children, {
        ref: (node: HTMLAnchorElement | null) => {
          nodeRef.current = node;
        },
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        "aria-label": label,
      } as AnchorHTMLAttributes<HTMLAnchorElement>)}
      {open && rect
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: rect.top + rect.height / 2, left: rect.right + 10 }}
              className="animate-in fade-in-0 zoom-in-95 slide-in-from-left-1 pointer-events-none fixed z-50 -translate-y-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-popover-foreground shadow-lg duration-150"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
