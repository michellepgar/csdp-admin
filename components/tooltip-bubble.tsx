"use client";

import { createPortal } from "react-dom";

/* The floating label bubble shared by every hover-tooltip in the app
   (components/icon-tooltip.tsx for the sidebar's collapsed icons,
   components/hover-label.tsx for plain buttons) -- pulled out on its
   own so both only need to supply where it goes (`rect`, the hovered
   element's own bounding box) and what it says. Portaled to <body> so
   an ancestor's overflow-y-auto (which per the CSS overflow spec also
   clips overflow-x once set) can never clip it, no matter where in
   the page it's used. */
export function TooltipBubble({ label, rect }: { label: string; rect: DOMRect | undefined }) {
  if (!rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="tooltip"
      style={{ top: rect.top + rect.height / 2, left: rect.right + 10 }}
      className="animate-in fade-in-0 zoom-in-95 slide-in-from-left-1 pointer-events-none fixed z-50 -translate-y-1/2 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-primary-foreground shadow-lg duration-150"
    >
      {label}
    </div>,
    document.body,
  );
}
