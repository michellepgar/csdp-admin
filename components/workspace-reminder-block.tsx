"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { StatusBadge } from "@/components/status-badge";
import { dueState } from "@/lib/workspace";
import type { ReminderContent } from "@/lib/workspace";

const TIME_ZONE = "America/New_York";
const REFRESH_MS = 5 * 60 * 1000;
const MAX_TEXT = 500;

/* "Today" in the team's timezone. The value is read through
   useSyncExternalStore: the server snapshot is "" (render neutral, no due
   tone), so hydration always agrees; the client then reads the real date and
   re-reads it when the tab becomes visible again or every 5 minutes, so a
   reminder flips to Overdue after midnight without a reload. */
function subscribeToday(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  const timer = setInterval(onChange, REFRESH_MS);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
const getToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
function useTodayIso(): string {
  return useSyncExternalStore(subscribeToday, getToday, () => "");
}

/* "2026-10-02" -> "Fri, Oct 2". Built from the parts as a UTC date so no
   timezone can shift it a day. */
function formatDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

type Props = {
  content: ReminderContent;
  onChange: (next: ReminderContent) => void;
  /** Save right now instead of waiting for the canvas's debounce. */
  onFlush?: () => void;
};

/* The body of a reminder block. Text keeps a local draft and commits on
   blur (Escape reverts it); the checkbox and date commit immediately.
   Memoized on `content` only; the latest onChange/onFlush live in refs. */
function ReminderBlockImpl({ content, onChange, onFlush }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  const onFlushRef = useRef(onFlush);
  useLayoutEffect(() => {
    contentRef.current = content;
    onChangeRef.current = onChange;
    onFlushRef.current = onFlush;
  });

  const todayIso = useTodayIso();
  const state = todayIso && !content.done ? dueState(content.due, todayIso) : "none";
  const shownText = draft ?? content.text;

  function setDraftBoth(next: string | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function emit(next: ReminderContent) {
    contentRef.current = next;
    onChangeRef.current(next);
  }

  function commitText() {
    const pending = draftRef.current;
    setDraftBoth(null);
    if (pending !== null && pending !== contentRef.current.text) emit({ ...contentRef.current, text: pending });
  }

  // Leaving the page with half-typed text: commit it and save right away.
  const hideRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    hideRef.current = () => {
      if (draftRef.current === null) return;
      commitText();
      onFlushRef.current?.();
    };
  });
  const hasDraft = draft !== null;
  useEffect(() => {
    if (!hasDraft) return;
    const onHide = () => hideRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hideRef.current();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasDraft]);

  // Auto-grow the text area to fit its text.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [shownText]);

  const tint = state === "overdue" ? "bg-status-danger text-status-danger-foreground" : state === "today" ? "bg-status-warning text-status-warning-foreground" : "";

  return (
    <div className={`flex min-h-full flex-col gap-2 p-3 transition-colors ${tint}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={content.done}
          onChange={(e) => emit({ ...contentRef.current, done: e.target.checked })}
          aria-label={content.done ? "Mark reminder as not done" : "Mark reminder as done"}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-ring"
        />
        <textarea
          ref={areaRef}
          rows={1}
          maxLength={MAX_TEXT}
          value={shownText}
          placeholder="Remind me to…"
          aria-label="Reminder text"
          onChange={(e) => setDraftBoth(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setDraftBoth(null);
            }
          }}
          className={`min-w-0 flex-1 resize-none overflow-hidden rounded-md bg-transparent px-1.5 py-1 text-base leading-snug outline-none placeholder:text-muted-foreground focus-visible:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring/40 ${
            content.done ? "text-muted-foreground line-through" : ""
          }`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-9">
        <input
          type="date"
          value={content.due ?? ""}
          onChange={(e) => emit({ ...contentRef.current, due: e.target.value || null })}
          aria-label="Due date"
          className="h-8 rounded-md border border-ring/30 bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        {content.due && (
          <button
            type="button"
            onClick={() => emit({ ...contentRef.current, due: null })}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-ring/15 hover:text-foreground"
          >
            Clear
          </button>
        )}
        {state === "overdue" && <StatusBadge tone="danger">Overdue</StatusBadge>}
        {state === "today" && <StatusBadge tone="warning">Due today</StatusBadge>}
        {state === "upcoming" && content.due && <span className="text-xs text-muted-foreground">{formatDue(content.due)}</span>}
      </div>
    </div>
  );
}

export const WorkspaceReminderBlock = memo(ReminderBlockImpl, (a, b) => a.content === b.content);
