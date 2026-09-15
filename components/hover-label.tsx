"use client";

import { useState, type ReactNode } from "react";
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
export function HoverLabel({
  label,
  children,
  className,
  side = "right",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
}) {
  const [rect, setRect] = useState<DOMRect>();

  function show(event: React.SyntheticEvent<HTMLSpanElement>) {
    setRect(event.currentTarget.getBoundingClientRect());
  }

  return (
    <span
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={() => setRect(undefined)}
      onFocus={show}
      onBlur={() => setRect(undefined)}
    >
      {children}
      <TooltipBubble label={label} rect={rect} side={side} />
    </span>
  );
}
