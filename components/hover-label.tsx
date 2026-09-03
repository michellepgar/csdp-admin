"use client";

import { useRef, useState, type ReactNode } from "react";
import { TooltipBubble } from "@/components/tooltip-bubble";
import { cn } from "@/lib/utils";

/* Same floating hover label as components/icon-tooltip.tsx (see
   components/tooltip-bubble.tsx for the shared bubble), but for
   wrapping a plain button rather than a Link -- the shared Button
   component doesn't forward a ref to its real DOM node (same
   ref-forwarding gap already confirmed on the shared Input wrapper),
   so cloning a ref onto it the way IconTooltip does for Link would
   silently never work. This instead wraps `children` in a normal
   inline-flex span and measures THAT span's own box, which hugs its
   one child tightly enough to stand in for it -- no dependency on the
   child's own ref support at all. */
export function HoverLabel({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const rect = open ? wrapperRef.current?.getBoundingClientRect() : undefined;

  return (
    <span
      ref={wrapperRef}
      className={cn("inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <TooltipBubble label={label} rect={rect} />
    </span>
  );
}
