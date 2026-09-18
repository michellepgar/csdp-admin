"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Mention } from "@/lib/app-state";

const PANEL_WIDTH = 260;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function hrefFor(mention: Mention): string {
  return mention.source === "issue_comment" ? `/issues?expandIssue=${mention.issueId}` : `/notes?highlightNote=${mention.noteId}`;
}

/* Independent from the existing per-page nav-alert-dot pattern
   (Private/General Notes ack, Issues comment ack) -- Michelle asked
   for @mentions to get their OWN bell rather than folding into those,
   since a mention is about being personally called out by name, not
   "this whole page has unread activity". Opening the dropdown does NOT
   clear anything (matches Michelle's explicit answer on this) -- only
   clicking an individual mention (which also navigates straight to
   it) marks that one read. Portaled + viewport-clamped both
   horizontally and vertically, same reasoning as
   components/issue-comments.tsx's panel and
   components/mention-autocomplete.tsx -- this bell sits at the very
   bottom of the sidebar, so a naive downward-opening dropdown would
   run off the bottom of the screen on most viewports. */
export function MentionsBell({
  mentions,
  markMentionRead,
  collapsed,
}: {
  mentions: Mention[];
  markMentionRead: (formData: FormData) => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unreadCount = mentions.filter((m) => !m.readAt).length;

  function toggleOpen() {
    if (!open && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  function handleMentionClick(mention: Mention) {
    const fd = new FormData();
    fd.set("id", mention.id);
    markMentionRead(fd);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={`${unreadCount} unread mention${unreadCount === 1 ? "" : "s"}`}
        className="relative flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        <Bell className="h-4 w-4 flex-none" />
        {!collapsed && <span>Mentions</span>}
        {unreadCount > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger-foreground px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            style={{
              position: "fixed",
              // Opens upward when the bell (near the very bottom of the
              // sidebar) doesn't have room below it -- same "which side
              // has room" check as the existing openUpward dropdown
              // pattern this session already established elsewhere,
              // just computed inline here since this is the only
              // vertical-flip case among this feature's portaled panels.
              ...(window.innerHeight - rect.bottom < 280
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
              left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
              width: PANEL_WIDTH,
            }}
            className="z-50 max-h-80 space-y-1 overflow-y-auto rounded-md border bg-background p-2 shadow-lg"
          >
            {mentions.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">No mentions yet.</p>
            ) : (
              mentions.map((m) => (
                <Link
                  key={m.id}
                  href={hrefFor(m)}
                  onClick={() => handleMentionClick(m)}
                  className={`block rounded-md p-2 text-xs hover:bg-muted ${!m.readAt ? "bg-muted/60" : ""}`}
                >
                  <div className="font-semibold">{m.mentionerName} mentioned you</div>
                  <div className="mt-0.5 text-muted-foreground">{m.snippet}</div>
                  <div className="mt-0.5 text-muted-foreground">{fmtDateTime(m.createdAt)}</div>
                </Link>
              ))
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
