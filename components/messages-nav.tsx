"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { getChatSummary } from "@/app/(app)/messages/actions";
import { createClient } from "@/lib/supabase/client";
import { playChime, readSoundOn } from "@/lib/notification-sound";
import { TEAM_ROOM, type ChatMessage, type ChatSummary } from "@/lib/chat";
import { cn } from "@/lib/utils";

const REAL_POLL_MS = 20_000;
const DEMO_POLL_MS = 3_000;

interface ChatToast {
  key: string;
  room: string;
  senderName: string;
  body: string;
}

function isDemoSession() {
  return document.cookie.includes("demo-mode=1");
}

function roomBeingViewed(): string | null {
  if (window.location.pathname !== "/messages" || document.visibilityState !== "visible") return null;
  return new URLSearchParams(window.location.search).get("room") || TEAM_ROOM;
}

/* The sidebar's "Messages" link: shows the unread count, and pops up a
   toast (with the chime) the moment a new message arrives in a chat
   you're not currently looking at. The single place that watches for
   new messages -- it broadcasts what it finds (window events
   "chat:summary" / "chat:message") so the Messages page can update
   live without opening a second subscription.

   New messages arrive two ways: Supabase Realtime pushes an INSERT the
   instant it happens (real accounts), and a background poll checks
   every 20s as a safety net (3s in the demo, which has no realtime).
   Either one just calls refresh(), which re-reads the per-room unread
   counts and compares them to the last known ones. */
export function MessagesNav({ collapsed, linkClassName }: { collapsed: boolean; linkClassName: string }) {
  const [total, setTotal] = useState(0);
  const [toasts, setToasts] = useState<ChatToast[]>([]);
  const previousUnread = useRef<Map<string, number> | null>(null);

  const refresh = useCallback(async () => {
    const summary: ChatSummary | null = await getChatSummary();
    if (!summary) return;
    setTotal(summary.totalUnread);
    window.dispatchEvent(new CustomEvent("chat:summary", { detail: summary }));

    const previous = previousUnread.current;
    const next = new Map<string, number>();
    const fresh: ChatMessage[] = [];
    const viewing = roomBeingViewed();
    for (const [room, info] of Object.entries(summary.rooms)) {
      next.set(room, info.unread);
      // The very first read only sets the baseline -- messages that were
      // already waiting when you opened the app aren't "new".
      if (previous && info.unread > (previous.get(room) ?? 0) && info.last && info.last.senderName !== summary.me && room !== viewing) {
        fresh.push(info.last);
      }
    }
    previousUnread.current = next;

    if (fresh.length > 0) {
      setToasts((current) => [...fresh.map((m) => ({ key: m.id, room: m.room, senderName: m.senderName, body: m.body })), ...current].slice(0, 3));
      if (readSoundOn()) playChime();
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial read of the unread counts; later updates arrive from the poll and realtime callbacks.
    void refresh();
    const timer = setInterval(() => void refresh(), isDemoSession() ? DEMO_POLL_MS : REAL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onRefresh = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("chat:refresh", onRefresh);

    let cleanupRealtime: (() => void) | undefined;
    if (!isDemoSession()) {
      const supabase = createClient();
      const channel = supabase
        .channel("chat-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
          const row = payload.new as { id: string; room: string; sender_name: string; body: string; created_at: string };
          window.dispatchEvent(
            new CustomEvent("chat:message", {
              detail: { id: row.id, room: row.room, senderName: row.sender_name, body: row.body, createdAt: row.created_at } satisfies ChatMessage,
            }),
          );
          void refresh();
        })
        .subscribe();
      cleanupRealtime = () => void supabase.removeChannel(channel);
    }

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("chat:refresh", onRefresh);
      cleanupRealtime?.();
    };
  }, [refresh]);

  function dismiss(key: string) {
    setToasts((current) => current.filter((t) => t.key !== key));
  }

  return (
    <>
      <Link href="/messages" prefetch={false} title={!collapsed ? "Messages" : undefined} className={linkClassName}>
        <span className="relative flex-none">
          <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {collapsed && total > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-600" />}
        </span>
        {!collapsed && <span className="min-w-0 truncate">Messages</span>}
        {!collapsed && total > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger-foreground px-1 text-[10px] font-semibold text-white">
            {total}
          </span>
        )}
      </Link>
      {toasts.length > 0 && typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2" aria-live="polite">
          {toasts.map((t) => {
            const isTeam = t.room === TEAM_ROOM;
            return (
              <div key={t.key} role="status" className={cn("pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-l-4 border-l-emerald-600 bg-background p-3 shadow-xl")}>
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-600 text-white">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <Link href={`/messages?room=${encodeURIComponent(t.room)}`} onClick={() => dismiss(t.key)} className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{isTeam ? `${t.senderName} in Team chat` : `${t.senderName} sent you a message`}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{t.body}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(t.key)}
                  aria-label="Close message notification"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

