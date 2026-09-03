"use client";

import { cloneElement, useRef, useState, type ReactElement, type AnchorHTMLAttributes } from "react";
import { TooltipBubble } from "@/components/tooltip-bubble";

/* A small, stylish hover label for the sidebar's icon-only mode
   (components/sidebar.tsx) -- a native `title` attribute already
   shows a tooltip, but it's slow to appear (~1s) and can't be
   styled, which is exactly what Michelle asked to improve.

   No wrapper DOM node: `children` (always the one nav Link) gets its
   ref and hover/focus handlers cloned directly onto it, so this adds
   zero layout of its own -- just the floating label (see
   components/tooltip-bubble.tsx). `active` (tied to the sidebar's own
   collapsed state) turns all of this off when the link already shows
   its own visible text, where a second label saying the same thing
   would be redundant.

   Only safe here because Link forwards its ref straight to the real
   DOM <a> -- components/hover-label.tsx exists as a sibling to this
   for exactly the cases where that isn't true (e.g. the shared
   Button/Input wrappers, confirmed by direct testing NOT to forward a
   ref to their real DOM node). Reach for that one instead of cloning
   onto anything but a plain Link. */
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
      <TooltipBubble label={label} rect={rect} />
    </>
  );
}
