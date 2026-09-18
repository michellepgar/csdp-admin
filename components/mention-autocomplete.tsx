"use client";

import { createPortal } from "react-dom";
import { initialsForName } from "@/lib/team-presence";
import type { Va } from "@/lib/app-state";

const PANEL_WIDTH = 200;

/* Shared @mention-autocomplete dropdown for both the Issue Comments
   plain <textarea> (components/issue-comments.tsx) and the General
   Notes/Private Notes contentEditable composer
   (components/sticky-note-composer.tsx) -- those two inputs need very
   different caret-tracking code (a textarea has selectionStart/End; a
   contentEditable needs window.getSelection()/Range), so each host
   computes its own `query`/`anchorRect` and this component only
   renders the resulting filtered list. Portaled + position:fixed +
   viewport-clamped for the same reason as components/issue-comments.tsx's
   comment panel: this can render inside a table's overflow-x-auto
   wrapper or a scrollable composer, either of which would clip a
   same-DOM-tree absolutely-positioned dropdown. */
export function MentionAutocomplete({
  query,
  anchorRect,
  vas,
  onSelect,
}: {
  /** Text typed after "@" so far (no "@" itself). Null means closed. */
  query: string | null;
  anchorRect: DOMRect | null;
  vas: Va[];
  onSelect: (name: string) => void;
  /** Not read by this component -- each host owns its own close logic
   *  (blur, Escape, selecting a match) and calls this when it decides
   *  the dropdown should go away. Kept in the prop list so a host's
   *  Escape-key handler has something typed to call, even though this
   *  component itself never invokes it (it has no outside-click
   *  detection of its own -- closing is purely query becoming null). */
  onClose: () => void;
}) {
  if (query === null || !anchorRect || typeof document === "undefined") return null;

  const matches = vas.filter((v) => v.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6);
  if (matches.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: anchorRect.bottom + 4,
        left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - PANEL_WIDTH - 8)),
        width: PANEL_WIDTH,
      }}
      className="z-50 overflow-hidden rounded-md border bg-background shadow-lg"
    >
      {matches.map((va) => (
        <button
          key={va.id}
          type="button"
          // onMouseDown (not onClick) fires before the host input blurs,
          // same reasoning as sticky-note-composer.tsx's preserveSelection
          // -- by the time a click's onClick would run, the host has
          // already lost focus/selection, which the caret-based insertion
          // in the host components needs intact.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(va.name);
          }}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
        >
          <span
            className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: va.color || "var(--muted-foreground)" }}
          >
            {initialsForName(va.name)}
          </span>
          {va.name}
        </button>
      ))}
    </div>,
    document.body,
  );
}
