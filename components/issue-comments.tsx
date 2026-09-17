"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import type { Issue } from "@/lib/app-state";

/* timeZone pinned to Michelle's own working timezone -- this panel only
   ever renders after the viewer opens it (never during SSR, so no
   hydration-mismatch risk like components/issues-list.tsx's fmtDate),
   but every other timestamp in the app is now pinned the same way, and
   a comment thread with a mix of viewer-local and Eastern times would
   be confusing. */
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

const PANEL_WIDTH = 288; // w-72

/* A comment thread per issue, replacing the old single free-text Note/
   Fix field -- opens as a dropdown showing every past comment plus a
   form to add another. Portaled to <body> (same reasoning as
   components/tooltip-bubble.tsx) rather than a plain absolute-positioned
   child: every table this renders inside (components/issues-list.tsx)
   wraps itself in overflow-x-auto for horizontal scrolling, which
   clips a same-DOM-tree dropdown no matter which side it opens toward
   -- confirmed directly, the panel was cut off mid-width. Positioning
   from the button's own getBoundingClientRect() sidesteps that
   entirely, same fix as the Dropdown-clipping-near-the-bottom-of-the-
   viewport bug fixed earlier this session (openUpward), just for
   horizontal clipping instead of vertical.

   The blinking dot (reusing the same .priority-dot animation already
   defined in app/globals.css) shows whenever the current user hasn't
   seen the LATEST comment yet -- commentAckBy is reset to just the
   poster's own name on every new comment
   (app/(app)/issues/actions.ts's addIssueComment), so posting one
   re-flags it as unread for everyone else. Opening the dropdown acks
   it for whoever opened it. */
export function IssueComments({
  issue,
  currentUserName,
  addIssueComment,
  ackIssueComments,
}: {
  issue: Issue;
  currentUserName: string;
  addIssueComment: (formData: FormData) => void;
  ackIssueComments: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const comments = issue.comments || [];
  const unread = comments.length > 0 && !(issue.commentAckBy || []).includes(currentUserName);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggleOpen() {
    const opening = !open;
    if (opening && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen(opening);
    if (opening && unread) {
      const fd = new FormData();
      fd.set("issueId", issue.id);
      ackIssueComments(fd);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={`${comments.length} comment${comments.length === 1 ? "" : "s"} -- ${unread ? "new activity" : "open to view or add a comment"}`}
        className="relative flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-muted"
      >
        <MessageCircle className="h-4 w-4" />
        {comments.length > 0 && <span className="text-xs">{comments.length}</span>}
        {unread && <span className="priority-dot absolute -right-0.5 -top-0.5 m-0" aria-hidden />}
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)),
            width: PANEL_WIDTH,
          }}
          className="z-50 space-y-2 rounded-md border bg-background p-2 shadow-lg"
        >
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border bg-record-background p-1.5 text-xs">
                  <div className="mb-0.5 font-semibold text-muted-foreground">{c.author} · {fmtDateTime(c.createdAt)}</div>
                  <div className="whitespace-pre-wrap break-words text-sm text-foreground">{c.text}</div>
                </div>
              ))}
            </div>
          )}
          <form
            action={(formData) => addIssueComment(formData)}
            onSubmit={(e) => {
              const form = e.currentTarget;
              requestAnimationFrame(() => form.reset());
            }}
            className="flex gap-1"
          >
            <input type="hidden" name="issueId" value={issue.id} />
            <textarea
              name="text"
              required
              placeholder="Add a comment…"
              rows={2}
              className="w-full min-w-0 flex-1 resize-y rounded-md border px-1.5 py-1 text-xs"
            />
            <SubmitButton pendingLabel="…" size="xs">Post</SubmitButton>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
