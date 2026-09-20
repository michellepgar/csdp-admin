"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, MessageCircle, Send, Users, X } from "lucide-react";
import { fetchChatMessages, markChatRead } from "@/app/(app)/messages/actions";
import { ChatMessageActions } from "@/components/chat-message-actions";
import { AttachButton, fileFromClipboard, MessageAttachment, PendingAttachment, sendChat, useAttachmentUrls } from "@/components/chat-attachments";
import { Avatar, dayKey, dayLabel, fmtTime, renderBody, STATUS_LABEL, useOnlineStatus } from "@/components/chat-parts";
import type { ChatPerson } from "@/components/chat-view";
import { attachmentTypeOf, canAccessRoom, dmRoom, MAX_CHAT_BODY, setFloatingChatRoom, TEAM_ROOM, validateAttachment, type ChatMessage, type ChatSummary } from "@/lib/chat";
import { cn } from "@/lib/utils";

const ROOM_KEY = "floating-chat-room";
const REAL_POLL_MS = 30_000;
const DEMO_POLL_MS = 3_000;

/* The small chat window that floats above the plan bubble on every page
   (hidden on the Messages page itself, which is the full version). A
   compact version of components/chat-view.tsx: same messages, same
   private/team rooms, same unread counts -- it just shares the events
   the Messages nav broadcasts ("chat:summary", "chat:message") and adds
   one of its own, "chat:open", which a new-message pop-up uses to open
   this window straight onto the chat that pinged you. */
export function FloatingChat({ me, people, canAddPriority }: { me: string; people: ChatPerson[]; canAddPriority: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState(TEAM_ROOM);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const roomRef = useRef(room);
  const openRef = useRef(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const statusOf = useOnlineStatus();

  const peopleByRoom = useMemo(() => {
    const map = new Map<string, ChatPerson>();
    for (const p of people) map.set(dmRoom(me, p.name), p);
    return map;
  }, [people, me]);
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

  // Remember which chat was last open (per browser).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROOM_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restores the saved chat once after mount (localStorage isn't available during server render).
      if (saved && canAccessRoom(saved, me)) setRoom(saved);
    } catch {
      // Falls back to the Team chat.
    }
  }, [me]);

  useEffect(() => {
    roomRef.current = room;
    try {
      localStorage.setItem(ROOM_KEY, room);
    } catch {
      // Not persisted -- harmless.
    }
  }, [room]);

  useEffect(() => {
    openRef.current = open;
    // Tells the Messages nav which chat is on screen, so it doesn't pop up
    // a toast for a message you're already looking at.
    setFloatingChatRoom(open ? room : null);
    // Opening the chat folds the plan window up (see plan-bubble.tsx).
    if (open) window.dispatchEvent(new Event("plan:collapse"));
    return () => setFloatingChatRoom(null);
  }, [open, room]);

  // Load the chat whenever the window is open on a room.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resets the thread while the selected chat loads.
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
    return () => {
      cancelled = true;
    };
  }, [open, room, markRead]);

  useEffect(() => {
    const onSummary = (event: Event) => setSummary((event as CustomEvent<ChatSummary>).detail);
    const onMessage = (event: Event) => {
      const message = (event as CustomEvent<ChatMessage>).detail;
      if (!openRef.current || message.room !== roomRef.current) return;
      mergeIn([message]);
      if (message.senderName !== me) markRead(message.room);
    };
    const onOpen = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target && canAccessRoom(target, me)) setRoom(target);
      setOpen(true);
    };
    window.addEventListener("chat:summary", onSummary);
    window.addEventListener("chat:message", onMessage);
    window.addEventListener("chat:open", onOpen);
    const onClose = () => setOpen(false);
    window.addEventListener("chat:close", onClose);

    const timer = setInterval(() => {
      if (!openRef.current) return;
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
      window.removeEventListener("chat:open", onOpen);
      window.removeEventListener("chat:close", onClose);
      clearInterval(timer);
    };
  }, [me, markRead, mergeIn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, room]);

  const attachmentUrls = useAttachmentUrls(messages);

  function pickFile(file: File) {
    const problem = validateAttachment(file.name, attachmentTypeOf(file.name, file.type), file.size);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPendingFile(file);
    composerRef.current?.focus();
  }

  async function send() {
    const text = draft.trim();
    if ((!text && !pendingFile) || sending) return;
    setSending(true);
    setError(null);
    const result = await sendChat(room, text, pendingFile);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft("");
    setPendingFile(null);
    if (result.message) mergeIn([result.message]);
    composerRef.current?.focus();
  }

  // The full Messages page is the same thing bigger -- no floating copy there.
  if (pathname === "/messages") return null;

  const total = summary?.totalUnread ?? 0;
  const title = room === TEAM_ROOM ? "Team chat" : peopleByRoom.get(room)?.name ?? "Chat";
  const subtitle = room === TEAM_ROOM ? `${people.filter((p) => statusOf(p.name) === "online").length} online` : `${STATUS_LABEL[statusOf(title)]} · private`;
  const fullHref = room === TEAM_ROOM ? "/messages" : `/messages?room=${encodeURIComponent(room)}`;

  const switchChip = (roomKey: string, label: string, avatar: React.ReactNode) => {
    const unread = summary?.rooms[roomKey]?.unread ?? 0;
    const active = room === roomKey;
    return (
      <button
        key={roomKey}
        type="button"
        onClick={() => setRoom(roomKey)}
        title={label}
        aria-label={`Open ${label}`}
        className={cn("relative flex-none rounded-full p-0.5 transition-shadow", active ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")}
      >
        {avatar}
        {unread > 0 && !active && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-red-600" />}
      </button>
    );
  };

  return (
    <>
      {open && (
        <div
          style={{ bottom: "calc(4.5rem + var(--plan-dock, 0px))" }}
          className="fixed right-4 z-50 flex h-[26rem] max-h-[calc(100dvh-10rem)] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-[bottom] duration-200"
        >
          <div className="flex flex-none items-center gap-2.5 bg-header-background px-3 py-2.5 text-white">
            {room === TEAM_ROOM ? (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/25"><Users className="h-4 w-4" /></span>
            ) : (
              <Avatar name={title} color={peopleByRoom.get(room)?.color} className="h-8 w-8 ring-2 ring-white/40" status={statusOf(title)} />
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="truncate text-xs text-white/80">{subtitle}</div>
            </div>
            <Link href={fullHref} onClick={() => setOpen(false)} aria-label="Open in the full Messages page" title="Open full page" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20">
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/30 px-3 py-2.5">
            {loading && <p className="py-4 text-center text-xs text-muted-foreground">Loading messages…</p>}
            {!loading && messages.length === 0 && !error && (
              <p className="py-6 text-center text-xs text-muted-foreground">No messages yet — say hello.</p>
            )}
            {messages.map((m, index) => {
              const mine = m.senderName === me;
              const showDay = index === 0 || dayKey(messages[index - 1].createdAt) !== dayKey(m.createdAt);
              return (
                <Fragment key={m.id}>
                  {showDay && (
                    <div className="flex justify-center py-0.5">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("relative max-w-[85%] rounded-2xl px-2.5 py-1.5 text-xs shadow-sm", m.body && "pr-6", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>
                      <ChatMessageActions message={m} canAddPriority={canAddPriority} mine={mine} compact />
                      {!mine && room === TEAM_ROOM && <div className="mb-0.5 text-[11px] font-semibold" style={{ color: colorByName.get(m.senderName) }}>{m.senderName}</div>}
                      {m.attachment && (
                        <div className={m.body ? "mb-1" : undefined}>
                          <MessageAttachment attachment={m.attachment} url={attachmentUrls[m.attachment.path]} mine={mine} compact messageId={m.id} onChanged={(updated) => mergeIn([updated])} sentAt={m.createdAt} />
                        </div>
                      )}
                      {m.body && <div className="whitespace-pre-wrap break-words">{renderBody(m.body, mine)}</div>}
                      <div className={cn("mt-0.5 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{fmtTime(m.createdAt)}</div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>

          <div className="flex-none border-t bg-card p-2">
            {error && <p role="alert" className="mb-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
            {pendingFile && <PendingAttachment file={pendingFile} onRemove={() => setPendingFile(null)} disabled={sending} />}
            <div className="flex items-end gap-1.5">
              <AttachButton onPick={pickFile} disabled={sending} className="h-9 w-9" />
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={(e) => {
                  const file = fileFromClipboard(e);
                  if (file) {
                    e.preventDefault();
                    pickFile(file);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={MAX_CHAT_BODY}
                placeholder={room === TEAM_ROOM ? "Message the team…" : `Message ${title}…`}
                aria-label="Write a message"
                className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border bg-background px-2.5 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send message"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {switchChip(TEAM_ROOM, "Team chat", <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white"><Users className="h-3 w-3" /></span>)}
              {people.map((p) => switchChip(dmRoom(me, p.name), p.name, <Avatar name={p.name} color={p.color} className="h-6 w-6 text-[9px]" status={statusOf(p.name)} />))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : `Open chat${total > 0 ? `, ${total} unread` : ""}`}
        aria-expanded={open}
        style={{ bottom: "calc(1rem + var(--plan-dock, 0px))" }}
        className="fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-[bottom,transform] duration-200 hover:scale-105 hover:bg-emerald-700"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">{total}</span>
        )}
      </button>
    </>
  );
}
