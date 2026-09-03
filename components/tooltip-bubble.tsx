"use client";

import { createPortal } from "react-dom";

/* The floating label bubble shared by every hover-tooltip in the app
   (components/icon-tooltip.tsx for the sidebar's collapsed icons,
   components/hover-label.tsx for plain buttons) -- pulled out on its
   own so both only need to supply where it goes (`rect`, the hovered
   element's own bounding box) and what it says. Portaled to <body> so
   an ancestor's overflow-y-auto (which per the CSS overflow spec also
   clips overflow-x once set) can never clip it, no matter where in
   the page it's used.

   `side` picks which edge of `rect` the bubble anchors to -- "right"
   (the default, used by the sidebar's icons, which sit at the far
   left edge of the screen so there's nowhere else for a label to go)
   or "left" (used by the Yearly Checklist's arrow, which sits at the
   right edge of its own row -- a right-anchored bubble there would
   point off into empty space instead of back at the row it labels). */
export function TooltipBubble({
  label,
  rect,
  side = "right",
}: {
  label: string;
  rect: DOMRect | undefined;
  side?: "left" | "right";
}) {
  if (!rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="tooltip"
      style={
        side === "left"
          ? { top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 10 }
          : { top: rect.top + rect.height / 2, left: rect.right + 10 }
      }
      className={`animate-in fade-in-0 zoom-in-95 pointer-events-none fixed z-50 -translate-y-1/2 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-primary-foreground shadow-lg duration-150 ${
        side === "left" ? "slide-in-from-right-1" : "slide-in-from-left-1"
      }`}
    >
      {label}
    </div>,
    document.body,
  );
}
