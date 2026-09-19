"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchChatMessages, markChatRead, sendChatMessage } from "@/app/(app)/messages/actions";
import { canAccessRoom, dmRoom, MAX_CHAT_BODY, TEAM_ROOM, type ChatMessage, type ChatSummary } from "@/lib/chat";
import { Avatar, dayKey, dayLabel, fmtTime, renderBody, STATUS_LABEL, useOnlineStatus } from "@/components/chat-parts";
import { cn } from "@/lib/utils";

export interface ChatPerson {
  id: string;
  name: string;
  color?: string;
}

const REAL_POLL_MS = 30_000;
const DEMO_POLL_MS = 3_000;


/* The Messages page: a list of chats on the left (Team + one private
   chat per teammate, each with an unread badge) and the open
   conversation on the right. Live updates come from the Messages nav
   (components/messages-nav.tsx), which watches for new messages and
   broadcasts them as window events -- this component only listens, so
   there's a single realtime subscription per tab. */
export function ChatView({ me, people, initialRoom }: { me: string; people: ChatPerson[]; initialRoom?: string }) {
  const startRoom = initialRoom && canAccessRoom(initialRoom, me) ? initialRoom : TEAM_ROOM;
  const [room, setRoom] = useState(startRoom);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const roomRef = useRef(room);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // A toast (or link) can point this already-open page at a different
  // chat -- follow the ?room= it carries.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Follows a changed ?room= prop (e.g. a toast link while this page is already open).
    if (initialRoom && canAccessRoom(initialRoom, me)) setRoom(initialRoom);
  }, [initialRoom, me]);

  const peopleByRoom = useMemo(() => {
    const map = new Map<string, ChatPerson>();
    for (const p of people) map.set(dmRoom(me, p.name), p);
    return map;
  }, [people, me]);
  const statusOf = useOnlineStatus();

  const colorByName = useMemo(() => new Map(people.map((p) => [p.name, p.color])), [people]);

  const markRead = useCallback((forRoom: string) => {
    void markChatRead(forRoom).then(() => window.dispatchEvent(new Event("chat:refresh")));
  }, []);

  const mergeIn = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  // Open (or switch to) a chat: load it, mark it read, keep the URL in
  // sync so a refresh or shared link lands on the same chat.
  useEffect(() => {
    roomRef.current = room;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resets the thread while the newly selected chat loads.
    setLoading(true);
    setMessages([]);
    setError(null);
    void fetchChatMessages(room).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) setError(result.error);
      else setMessages(result.messages);
      markRead(room);
    });
    window.history.replaceState(null, "", room === TEAM_ROOM ? "/messages" : `/messages?room=${encodeURIComponent(room)}`);
    return () => {
      cancelled = true;
    };
  }, [room, markRead]);

  useEffect(() => {
    const onSummary = (event: Event) => setSummary((event as CustomEvent<ChatSummary>).detail);
    const onMessage = (event: Event) => {
      const message = (event as CustomEvent<ChatMessage>).detail;
      if (message.room !== roomRef.current) return;
      mergeIn([message]);
      if (message.senderName !== me) markRead(message.room);
    };
    window.addEventListener("chat:summary", onSummary);
    window.addEventListener("chat:message", onMessage);
    window.dispatchEvent(new Event("chat:refresh"));

    // Safety net alongside the live push: re-read the open chat now and
    // then (fast in the demo, which has no realtime).
    const timer = setInterval(() => {
      const openRoom = roomRef.current;
      void fetchChatMessages(openRoom).then((result) => {
        if (result.error || openRoom !== roomRef.current) return;
        const newest = result.messages[result.messages.length - 1];
        mergeIn(result.messages);
        if (newest && newest.senderName !== me) markRead(openRoom);
      });
    }, document.cookie.includes("demo-mode=1") ? DEMO_POLL_MS : REAL_POLL_MS);

    return () => {
      window.removeEventListener("chat:summary", onSummary);
      window.removeEventListener("chat:message", onMessage);
      clearInterval(timer);
    };
  }, [me, markRead, mergeIn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, room]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const result = await sendChatMessage(room, text);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft("");
    if (result.message) mergeIn([result.message]);
    composerRef.current?.focus();
  }

  const title = room === TEAM_ROOM ? "Team chat" : peopleByRoom.get(room)?.name ?? "Chat";
  const subtitle = room === TEAM_ROOM ? `Everyone on the team · ${people.filter((p) => statusOf(p.name) === "online").length} online` : `${STATUS_LABEL[statusOf(title)]} · private chat`;

  const roomButton = (roomKey: string, label: string, avatar: React.ReactNode) => {
    const info = summary?.rooms[roomKey];
    const active = room === roomKey;
    return (
      <button
        key={roomKey}
        type="button"
        onClick={() => setRoom(roomKey)}
        className={cn(
          "flex w-full min-w-40 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors md:min-w-0",
          active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted",
        )}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", info?.unread ? "font-semibold" : "font-medium")}>{label}</span>
          {info?.last && (
            <span className="block truncate text-xs text-muted-foreground">
              {info.last.senderName === me ? "You: " : roomKey === TEAM_ROOM ? `${info.last.senderName}: ` : ""}
              {info.last.body}
            </span>
          )}
        </span>
        {info && info.unread > 0 && !active && (
          <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{info.unread}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[26rem] flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:grid md:grid-cols-[260px_1fr]">
      <div className="flex flex-none gap-1 overflow-x-auto border-b bg-muted/30 p-2 md:block md:space-y-1 md:overflow-y-auto md:border-b-0 md:border-r">
        {roomButton(
          TEAM_ROOM,
          "Team chat",
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-600 text-white"><Users className="h-4 w-4" /></span>,
        )}
        <div className="hidden px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:block">Private</div>
        {people.map((p) => roomButton(dmRoom(me, p.name), p.name, <Avatar name={p.name} color={p.color} className="h-9 w-9" status={statusOf(p.name)} />))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-2.5 border-b bg-header-background px-4 py-2.5 text-white">
          {room === TEAM_ROOM ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25"><Users className="h-4 w-4" /></span>
          ) : (
            <Avatar name={title} color={peopleByRoom.get(room)?.color} className="h-8 w-8 ring-2 ring-white/40" status={statusOf(title)} />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-white/80">{subtitle}</div>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/20 px-4 py-3">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading messages…</p>}
          {!loading && messages.length === 0 && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs text-muted-foreground">Say hello — {room === TEAM_ROOM ? "everyone on the team will see it" : "only you two will see this chat"}.</p>
            </div>
          )}
          {messages.map((m, index) => {
            const mine = m.senderName === me;
            const showDay = index === 0 || dayKey(messages[index - 1].createdAt) !== dayKey(m.createdAt);
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                  {!mine && <Avatar name={m.senderName} color={colorByName.get(m.senderName)} className="h-7 w-7" />}
                  <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>
                    {!mine && room === TEAM_ROOM && <div className="mb-0.5 text-xs font-semibold" style={{ color: colorByName.get(m.senderName) }}>{m.senderName}</div>}
                    <div className="whitespace-pre-wrap break-words">{renderBody(m.body, mine)}</div>
                    <div className={cn("mt-0.5 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{fmtTime(m.createdAt)}</div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className="flex-none border-t bg-card p-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={MAX_CHAT_BODY}
              placeholder={room === TEAM_ROOM ? "Message the team…" : `Message ${title}…`}
              aria-label="Write a message"
              className="min-h-10 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <Button type="button" onClick={() => void send()} disabled={sending || !draft.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </div>
  );
}
