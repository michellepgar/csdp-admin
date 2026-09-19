"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { initialsForName, PRESENCE_EVENT, readPublishedPresence, type TeamPresenceMember } from "@/lib/team-presence";
import { cn } from "@/lib/utils";

/* Small pieces shared by the full Messages page (chat-view.tsx) and the
   floating chat window (floating-chat.tsx). */

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function dayLabel(iso: string) {
  const key = dayKey(iso);
  if (key === dayKey(new Date().toISOString())) return "Today";
  if (key === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}

/* Plain text with clickable links -- message bodies are never rendered
   as HTML, so nothing a teammate types can inject markup. */
export function renderBody(body: string, mine: boolean) {
  return body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={cn("underline underline-offset-2 break-all", mine ? "text-primary-foreground" : "text-primary")}>
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export type OnlineStatus = "online" | "away" | "offline";

export function Avatar({ name, color, className, status }: { name: string; color?: string; className?: string; status?: OnlineStatus }) {
  return (
    <span
      className={cn("relative flex flex-none items-center justify-center rounded-full text-[11px] font-semibold text-white", className)}
      style={{ backgroundColor: color || "#64748b" }}
      aria-hidden
    >
      {initialsForName(name)}
      {status && (
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", status === "online" ? "bg-emerald-500" : status === "away" ? "bg-amber-400" : "bg-slate-400")} />
      )}
    </span>
  );
}

export const STATUS_LABEL: Record<OnlineStatus, string> = { online: "Online", away: "Away", offline: "Offline" };

/* Who's online: the sidebar's presence channel publishes it (see
   lib/team-presence.ts's publishPresence); the demo has no realtime, so
   it shows a fixed sample instead. Returns a lookup by name. */
export function useOnlineStatus(): (name: string) => OnlineStatus {
  const [presence, setPresence] = useState<TeamPresenceMember[]>([]);
  useEffect(() => {
    if (document.cookie.includes("demo-mode=1")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time sample data for the demo, which has no presence channel.
      setPresence([{ memberId: "demo-john", name: "John", status: "active" }, { memberId: "demo-alex", name: "Alex", status: "idle" }]);
      return;
    }
    setPresence(readPublishedPresence());
    const onPresence = (event: Event) => setPresence((event as CustomEvent<TeamPresenceMember[]>).detail);
    window.addEventListener(PRESENCE_EVENT, onPresence);
    return () => window.removeEventListener(PRESENCE_EVENT, onPresence);
  }, []);
  const byName = useMemo(() => {
    const map = new Map<string, OnlineStatus>();
    for (const m of presence) map.set(m.name, m.status === "active" ? "online" : "away");
    return map;
  }, [presence]);
  return (name: string) => byName.get(name) ?? "offline";
}
