"use client";

import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { CircleAlert, RotateCw, X } from "lucide-react";
import { clampRect } from "@/lib/workspace";
import type { Block, BlockKind, Rect } from "@/lib/workspace";

/* Every class name is written out in full so Tailwind can see it. */
const KIND_CHIP: Record<BlockKind, string> = {
  table: "bg-muted text-muted-foreground",
  note: "bg-muted text-muted-foreground",
  reminder: "bg-muted text-muted-foreground",
  review: "bg-primary/10 text-primary",
};

type DragState = { mode: "move" | "resize"; pointerId: number; startX: number; startY: number; origin: Rect; live: Rect };

/* The shared chrome around every block on a canvas: a header bar that is the
   drag handle, a delete button, a bottom-right resize handle, and the block's
   body (children).

   Contract for the caller (workspace-canvas.tsx):
   - `block` supplies kind, position, size and z. The frame owns no rect
     state: while dragging/resizing it calls onRectChange(rect) continuously
     (the caller stores it and passes the new block back), and onRectCommit(rect)
     exactly once when the gesture ends.
   - Every rect passes through clampRect(rect, block.kind): x/y never go below
     0, sizes stay within the kind's min/max. Nothing else clamps position, so
     the canvas simply grows right/down and scrolls.
   - `mobile` (below the sm breakpoint) turns the frame into a normal-flow,
     full-width card with no drag or resize handles. */
export function WorkspaceBlockFrame({
  block,
  active,
  mobile,
  title,
  icon,
  error,
  onRetry,
  onActivate,
  onRectChange,
  onRectCommit,
  onDelete,
  children,
}: {
  block: Block;
  /** The most recently pressed block -- gets a stronger ring. */
  active: boolean;
  mobile: boolean;
  title: string;
  icon: ReactNode;
  /** Small inline save error shown under the header; the local edit is kept. */
  error?: string | null;
  onRetry?: () => void;
  /** Called on any pointer press inside the block (bring to front). */
  onActivate: () => void;
  onRectChange: (rect: Rect) => void;
  onRectCommit: (rect: Rect) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const dragRef = useRef<DragState | null>(null);

  function begin(e: ReactPointerEvent<HTMLElement>, mode: DragState["mode"]) {
    if (mobile || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const origin: Rect = { x: block.x, y: block.y, w: block.w, h: block.h };
    dragRef.current = { mode, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin, live: origin };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const next = clampRect(
      drag.mode === "move" ? { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy } : { ...drag.origin, w: drag.origin.w + dx, h: drag.origin.h + dy },
      block.kind,
    );
    drag.live = next;
    onRectChange(next);
  }

  // Committing always runs first -- releasePointerCapture can throw (a
  // stale/already-released pointer, browser quirks) and, ordered before the
  // commit, would silently skip persisting the gesture if it did.
  function end(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    onRectCommit(drag.live);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  // A cancelled gesture (the browser took the pointer for scrolling, etc.)
  // goes back to where it started instead of committing a half-finished move.
  function cancel(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    onRectChange(drag.origin);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  function headerPointerDown(e: ReactPointerEvent<HTMLElement>) {
    // Buttons in the header (delete) must stay clickable.
    if ((e.target as HTMLElement).closest("button")) return;
    begin(e, "move");
  }

  const style: CSSProperties = mobile
    ? { minHeight: Math.min(block.h, 360) }
    : { position: "absolute", left: block.x, top: block.y, width: block.w, height: block.h, zIndex: block.z + 1 };

  return (
    <div
      data-block-id={block.id}
      onPointerDown={onActivate}
      style={style}
      className={`flex flex-col overflow-hidden rounded-xl border bg-record-background no-record-hover transition-shadow ${
        active ? "border-ring/60 shadow-md" : "border-border shadow-sm"
      }`}
    >
      <div
        onPointerDown={headerPointerDown}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={cancel}
        title={mobile ? undefined : "Drag to move"}
        className={`flex h-9 shrink-0 select-none items-center gap-2 border-b border-border bg-muted/50 px-2 ${
          mobile ? "" : "cursor-grab touch-none active:cursor-grabbing"
        }`}
      >
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${KIND_CHIP[block.kind]}`}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-foreground/80">{title}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          title={`Delete this ${title.toLowerCase()} block`}
          aria-label={`Delete this ${title.toLowerCase()} block`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-1.5 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-destructive/15">
              <RotateCw className="h-3 w-3" aria-hidden /> Retry
            </button>
          )}
        </div>
      )}

      <div className={`min-h-0 flex-1 ${mobile ? "max-h-[65vh] overflow-auto" : "overflow-auto"}`}>{children}</div>

      {!mobile && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); onActivate(); begin(e, "resize"); }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={cancel}
          title="Drag to resize"
          className="absolute bottom-0 right-0 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end rounded-tl-md bg-ring/10 p-0.5 text-ring/70 transition-colors hover:bg-ring/25 hover:text-ring"
        >
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
            <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
}
