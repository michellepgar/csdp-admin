"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Bell, ClipboardList, Flag, Volume2, VolumeX, X } from "lucide-react";
import type { Mention } from "@/lib/app-state";
import { countMyUnreadNotifications } from "@/app/(app)/mentions/actions";
import { playChime, readSoundOn, SOUND_KEY } from "@/lib/notification-sound";
import { getToastRoot } from "@/lib/toast-root";

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 416;
// How often an open tab asks whether something new arrived. Short on purpose:
// an assignment should reach the person within a few seconds. The check is a
// single head-only count query, and the page only re-fetches when it changes.
const POLL_MS = 6_000;
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function hrefFor(mention: Mention): string {
  if (mention.source === "priority_assignment" || mention.source === "task_assignment") return "/overview";
  return mention.source === "issue_comment" ? `/issues?expandIssue=${mention.issueId}` : `/notes?highlightNote=${mention.noteId}`;
}

function titleFor(mention: Mention): string {
  // Assignments don't say who made them -- just what was assigned.
  if (mention.source === "priority_assignment") return "A priority was assigned to you";
  if (mention.source === "task_assignment") return "A task was assigned to you";
  return `${mention.mentionerName} mentioned you`;
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
  const router = useRouter();
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  const unreadRef = useRef(unreadCount);
  // Ids already on screen at load (or already announced) -- anything
  // unread that shows up beyond these is genuinely new and pops up as a
  // toast. Dismissing a toast doesn't mark the notification read.
  const seenIds = useRef(new Set(mentions.map((m) => m.id)));
  const [toasts, setToasts] = useState<Mention[]>([]);

  useEffect(() => {
    const stored = readSoundOn();
    soundOnRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reads the saved preference once after mount (localStorage isn't available during server render).
    setSoundOn(stored);
  }, []);

  useEffect(() => {
    unreadRef.current = unreadCount;
  }, [unreadCount]);

  // A new unread notification pops up right away (and chimes) -- never on
  // first render, and never for one that's already been announced.
  useEffect(() => {
    const fresh = mentions.filter((m) => !m.readAt && !seenIds.current.has(m.id));
    for (const m of mentions) seenIds.current.add(m.id);
    if (fresh.length === 0) return;
    setToasts((current) => [...fresh, ...current].slice(0, 4));
    if (soundOnRef.current) playChime();
  }, [mentions]);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  // Background check for new notifications: a cheap count-only request
  // every few seconds while the tab is visible (and the moment you return to it). Only when the number differs
  // from what's showing does it refresh the page data -- which is what
  // updates the badge and (through the effect above) plays the chime.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      const count = await countMyUnreadNotifications();
      if (!cancelled && count >= 0 && count !== unreadRef.current) router.refresh();
    }
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [router]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // Preference just won't persist.
    }
    if (next) playChime();
  }

  function toggleOpen() {
    if (!open && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  function handleMentionClick(mention: Mention) {
    const fd = new FormData();
    fd.set("id", mention.id);
    markMentionRead(fd);
    dismissToast(mention.id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
        className="relative flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        <Bell className="h-4 w-4 flex-none" />
        {!collapsed && <span>Notifications</span>}
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
              // Opens on whichever side of the bell has more room, and its
              // height is capped to that room (minus an 8px margin), so
              // the list scrolls inside the panel instead of running off
              // the edge of the page -- the bell sits at the very bottom
              // of the sidebar, so upward is the usual case.
              ...(() => {
                const below = window.innerHeight - rect.bottom - 12;
                const above = rect.top - 12;
                const openDown = below >= 320 || below >= above;
                return openDown
                  ? { top: rect.bottom + 4, maxHeight: Math.min(PANEL_MAX_HEIGHT, below) }
                  : { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(PANEL_MAX_HEIGHT, above) };
              })(),
              left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
              width: Math.min(PANEL_WIDTH, window.innerWidth - 16),
            }}
            className="z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
          >
            <div className="flex flex-none items-center gap-2 bg-header-background px-3 py-2.5 text-white">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">{unreadCount} new</span>
              )}
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundOn ? "Turn notification sound off" : "Turn notification sound on"}
                title={soundOn ? "Sound on" : "Sound off"}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20"
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {mentions.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                  <Bell className="h-6 w-6 text-muted-foreground/60" />
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground">Mentions and assignments show up here.</p>
                </div>
              ) : (
                mentions.map((m) => {
                  const isPriority = m.source === "priority_assignment";
                  const isTask = m.source === "task_assignment";
                  const unread = !m.readAt;
                  return (
                    <Link
                      key={m.id}
                      href={hrefFor(m)}
                      onClick={() => handleMentionClick(m)}
                      className={`flex items-start gap-3 border-b border-l-4 px-3 py-3 last:border-b-0 transition-colors hover:bg-muted ${unread ? (isPriority ? "border-l-red-600 bg-red-500/10" : isTask ? "border-l-amber-500 bg-amber-500/10" : "border-l-green-600 bg-green-500/10") : "border-l-transparent"}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full ${isPriority ? "bg-red-600 text-white" : isTask ? "bg-amber-500 text-white" : "bg-green-600 text-white"} ${unread ? "" : "opacity-50"}`}>
                        {isPriority ? <Flag className="h-4 w-4" /> : isTask ? <ClipboardList className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>{titleFor(m)}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{m.snippet}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">{fmtDateTime(m.createdAt)}</span>
                      </span>
                      {unread && <span className="mt-2 h-2 w-2 flex-none rounded-full bg-red-600" aria-label="Unread" />}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
      {toasts.length > 0 && typeof document !== "undefined" && createPortal(
        <>
          {toasts.map((m) => {
            const isPriority = m.source === "priority_assignment";
            const isTask = m.source === "task_assignment";
            return (
              <div
                key={m.id}
                role="status"
                className={`pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-l-4 bg-background p-3 shadow-xl ${isPriority ? "border-l-red-600" : isTask ? "border-l-amber-500" : "border-l-green-600"}`}
              >
                <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-white ${isPriority ? "bg-red-600" : isTask ? "bg-amber-500" : "bg-green-600"}`}>
                  {isPriority ? <Flag className="h-4 w-4" /> : isTask ? <ClipboardList className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
                </span>
                <Link href={hrefFor(m)} onClick={() => handleMentionClick(m)} className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{titleFor(m)}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{m.snippet}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => dismissToast(m.id)}
                  aria-label="Close notification"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </>,
        getToastRoot(),
      )}
    </div>
  );
}
