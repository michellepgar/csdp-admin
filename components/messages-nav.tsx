"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { getChatSummary, purgeExpiredChatAttachments } from "@/app/(app)/messages/actions";
import { createClient } from "@/lib/supabase/client";
import { playChime, readSoundOn } from "@/lib/notification-sound";
import { getToastRoot } from "@/lib/toast-root";
import { getFloatingChatRoom, messagePreview, TEAM_ROOM, type ChatMessage, type ChatSummary } from "@/lib/chat";
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
  if (document.visibilityState !== "visible") return null;
  if (window.location.pathname !== "/messages") return getFloatingChatRoom();
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
      setToasts((current) => [...fresh.map((m) => ({ key: m.id, room: m.room, senderName: m.senderName, body: messagePreview(m) })), ...current].slice(0, 3));
      if (readSoundOn()) playChime();
    }
  }, []);

  // Deletes attachments past their retention period -- quietly, at most
  // about once a day per browser (the database only acts on files that
  // are actually expired, so an extra call is harmless).
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem("chat-attachments-purged-at") || 0);
      if (Date.now() - last < 20 * 60 * 60 * 1000) return;
      localStorage.setItem("chat-attachments-purged-at", String(Date.now()));
    } catch {
      // No storage -- just run it.
    }
    void purgeExpiredChatAttachments();
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
      let cancelled = false;
      // This project only allows PRIVATE realtime channels ("Allow public
      // access" is off -- see supabase/phase36_team_presence.sql), so the
      // channel must be private, and its access is granted by the policy
      // in supabase/phase56_chat_realtime_private.sql. The session token
      // is handed to the socket first so the join isn't checked before it
      // has one (same race the presence channel guards against).
      const channel = supabase.channel("chat-messages", { config: { private: true } });
      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
        if (cancelled) return;
        channel
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
          const row = payload.new as {
            id: string;
            room: string;
            sender_name: string;
            body: string;
            created_at: string;
            attachment_path?: string | null;
            attachment_name?: string | null;
            attachment_type?: string | null;
            attachment_size?: number | null;
          };
          window.dispatchEvent(
            new CustomEvent("chat:message", {
              detail: {
                id: row.id,
                room: row.room,
                senderName: row.sender_name,
                body: row.body,
                createdAt: row.created_at,
                attachment: row.attachment_path
                  ? { path: row.attachment_path, name: row.attachment_name ?? "file", type: row.attachment_type ?? "", size: Number(row.attachment_size ?? 0) }
                  : undefined,
              } satisfies ChatMessage,
            }),
          );
          void refresh();
        })
          .subscribe((status) => {
            // If the live connection can't be opened, stop it -- left alone
            // it retries every few seconds forever. The background check
            // below still delivers messages (just up to 20s later).
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") void supabase.removeChannel(channel);
          });
      })();
      cleanupRealtime = () => {
        cancelled = true;
        void supabase.removeChannel(channel);
      };
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
        <>
          {toasts.map((t) => {
            const isTeam = t.room === TEAM_ROOM;
            return (
              <div key={t.key} role="status" className={cn("pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-l-4 border-l-emerald-600 bg-background p-3 shadow-xl")}>
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-600 text-white">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <Link
                  href={`/messages?room=${encodeURIComponent(t.room)}`}
                  onClick={(event) => {
                    dismiss(t.key);
                    // Anywhere but the Messages page, the pop-up opens the floating
                    // chat right on that conversation instead of navigating away.
                    if (window.location.pathname !== "/messages") {
                      event.preventDefault();
                      window.dispatchEvent(new CustomEvent("chat:open", { detail: t.room }));
                    }
                  }}
                  className="min-w-0 flex-1"
                >
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
        </>,
        getToastRoot(),
      )}
    </>
  );
}

