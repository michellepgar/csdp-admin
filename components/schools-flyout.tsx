"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { School } from "lucide-react";
import { Input } from "@/components/ui/input";

/* Replaces the sidebar's collapsed icon-only mode showing one School
   icon PER school (components/sidebar.tsx) -- with 20+ schools that
   was a wall of identical icons needing its own inner scrollbar, not
   a shortcut. This is one icon that reveals the full school list (own
   search box included, since collapsed mode otherwise has nowhere to
   type one) in a flyout panel on hover.

   Portaled to <body> and positioned via the icon's own
   getBoundingClientRect, same reasoning as components/tooltip-bubble.
   tsx -- the sidebar's nav scrolls internally via overflow-y-auto,
   which (per the CSS overflow spec) also clips overflow-x, so an
   absolutely-positioned flyout anchored inside it would get clipped
   the moment it's long enough to need that scroll.

   The icon and the panel share the same `open` state and both call
   `show`/`scheduleHide` on their own hover -- scheduleHide has a
   short delay specifically so moving the mouse from the icon to the
   panel (a real gap in the DOM, even though they look adjacent
   on-screen) doesn't close it before the cursor arrives. */
export function SchoolsFlyout({
  schools,
  colorByVaName,
  schoolVaAssigned,
}: {
  schools: { id: string; name: string }[];
  colorByVaName: Map<string, string>;
  schoolVaAssigned: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const iconRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  function scheduleHide() {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }

  const rect = open ? iconRef.current?.getBoundingClientRect() : undefined;
  const filtered = [...schools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div ref={iconRef} onMouseEnter={show} onMouseLeave={scheduleHide}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Schools (${schools.length})`}
        title={`Schools (${schools.length})`}
        onFocus={show}
        onBlur={scheduleHide}
        className="flex items-center justify-center rounded-md py-2 hover:bg-muted"
      >
        <School className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400" />
      </div>
      {open && rect && typeof document !== "undefined"
        ? createPortal(
            <div
              onMouseEnter={show}
              onMouseLeave={scheduleHide}
              style={{ top: rect.top, left: rect.right + 8 }}
              className="animate-in fade-in-0 zoom-in-95 fixed z-50 flex max-h-[70vh] w-64 flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg duration-150"
            >
              <div className="space-y-2 border-b p-2">
                <div className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                  Schools ({schools.length})
                </div>
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search schools…"
                  className="h-8 text-sm"
                />
              </div>
              <div className="overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No schools match.</p>
                ) : (
                  filtered.map((s) => {
                    const vaName = schoolVaAssigned[s.id];
                    const color = vaName ? colorByVaName.get(vaName) : undefined;
                    return (
                      <Link
                        key={s.id}
                        href={`/schools/${s.id}`}
                        prefetch={false}
                        title={s.name}
                        className="block truncate rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        style={color ? { color } : undefined}
                      >
                        {s.name}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
