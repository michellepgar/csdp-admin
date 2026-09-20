"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Flag, MoreVertical, Send, StickyNote } from "lucide-react";
import { addChatMessageToGeneralNotes, addChatMessageToPriorities } from "@/app/(app)/messages/actions";
import { TEAM_ROOM, type ChatMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 272;
const MENU_HEIGHT = 170;

/* The vertical-dots button in the upper right of a chat message (the bubble needs
   `relative`, and some right padding so text never runs under the
   button). Clicking it opens a small menu to send the message's text to
   General Notes or Task Priorities without retyping it -- deliberately a
   click, not a hover, so it can't pop up by accident. Task Priorities is
   admin-only, same as everywhere else in the app. A message from a
   PRIVATE chat asks first, since both places are seen by the whole team.
   The menu is portaled and flips upward near the bottom of the screen so
   the chat's scrolling area never clips it. */
export function ChatMessageActions({ message, canAddPriority, mine }: { message: ChatMessage; canAddPriority: boolean; mine?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), result.ok ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!message.body) return null;

  function toggle() {
    if (!open && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen((value) => !value);
  }

  async function run(destination: "notes" | "priority") {
    setOpen(false);
    if (busy) return;
    const where = destination === "notes" ? "General Notes" : "Task Priorities";
    if (message.room !== TEAM_ROOM && !window.confirm(`This message is from a private chat. Adding it to ${where} makes it visible to the whole team. Continue?`)) return;
    setBusy(true);
    const outcome = destination === "notes" ? await addChatMessageToGeneralNotes(message.id) : await addChatMessageToPriorities(message.id);
    setBusy(false);
    setResult(outcome.error ? { text: outcome.error, ok: false } : { text: `Added to ${where}`, ok: true });
  }

  const item = "flex w-full items-center gap-3 border-l-4 border-transparent px-3 py-2.5 text-left transition-colors";

  return (
    <>
      {result ? (
        <span
          role="status"
          className={cn(
            "absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm",
            result.ok ? "border-green-600/40 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "border-red-600/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
          )}
        >
          {result.ok && <Check className="h-3 w-3" />}
          {result.text}
        </span>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-label="Message options"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Add this message to General Notes or Task Priorities"
          className={cn(
            "absolute right-0.5 top-1 flex h-5 w-5 items-center justify-center rounded-md disabled:opacity-50",
            mine ? "text-primary-foreground/80 hover:bg-primary-foreground/20" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            style={{
              position: "fixed",
              width: MENU_WIDTH,
              left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
              ...(window.innerHeight - rect.bottom < MENU_HEIGHT + 16 ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
            className="z-50 overflow-hidden rounded-xl border bg-background shadow-2xl ring-1 ring-black/5"
          >
            <div className="flex items-center gap-2 bg-header-background px-3 py-2 text-xs font-semibold text-white">
              <Send className="h-3.5 w-3.5" />
              Send this message to…
            </div>
            <button type="button" role="menuitem" onClick={() => void run("notes")} className={cn(item, "hover:border-amber-500 hover:bg-amber-500/10")}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-300">
                <StickyNote className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">General Notes</span>
                <span className="block text-xs text-muted-foreground">Saved as a note for the whole team</span>
              </span>
            </button>
            {canAddPriority && (
              <button type="button" role="menuitem" onClick={() => void run("priority")} className={cn(item, "border-t hover:border-red-500 hover:bg-red-500/10")}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-100 text-red-600 shadow-sm dark:bg-red-500/20 dark:text-red-300">
                  <Flag className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Task Priorities</span>
                  <span className="block text-xs text-muted-foreground">Unassigned, so anyone can claim it</span>
                </span>
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
