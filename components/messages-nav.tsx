"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getChatSummary, purgeExpiredChatAttachments } from "@/app/(app)/messages/actions";
import { createClient } from "@/lib/supabase/client";
import { type ChatMessage, type ChatSummary } from "@/lib/chat";

const REAL_POLL_MS = 20_000;
const DEMO_POLL_MS = 3_000;

function isDemoSession() {
  return document.cookie.includes("demo-mode=1");
}

/* The sidebar's "Messages" link: shows the unread count. It's the single
   place that watches for new messages -- it broadcasts what it finds
   (window events "chat:summary" / "chat:message") so the Messages page
   can update live without opening a second subscription.

   No pop-up toast here (Michelle: only mentions/assignments should
   interrupt you like that -- see components/mentions-bell.tsx's own
   toast) -- a new chat message only ever shows up as this badge, until
   you open Messages yourself.

   New messages arrive two ways: Supabase Realtime pushes an INSERT the
   instant it happens (real accounts), and a background poll checks
   every 20s as a safety net (3s in the demo, which has no realtime).
   Either one just calls refresh(), which re-reads the per-room unread
   counts. */
export function MessagesNav({ collapsed, linkClassName }: { collapsed: boolean; linkClassName: string }) {
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    const summary: ChatSummary | null = await getChatSummary();
    if (!summary) return;
    setTotal(summary.totalUnread);
    window.dispatchEvent(new CustomEvent("chat:summary", { detail: summary }));
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

  return (
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
  );
}

