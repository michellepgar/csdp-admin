"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aggregatePresence, initialsForName, visiblePresence, type PresenceStatus, type TeamPresenceMember } from "@/lib/team-presence";
import { cn } from "@/lib/utils";
import { HoverLabel } from "@/components/hover-label";

const IDLE_AFTER_MS = 5 * 60 * 1000;

export interface CurrentPresenceMember {
  id: string;
  name: string;
  color?: string;
}

function tabPresenceKey() {
  const storageKey = "team-presence-tab-key";
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);
  return created;
}

export function TeamPresence({ currentMember, collapsed }: { currentMember: CurrentPresenceMember; collapsed: boolean }) {
  const [members, setMembers] = useState<TeamPresenceMember[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const statusRef = useRef<PresenceStatus>("active");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("team-presence", {
      config: { presence: { key: tabPresenceKey() }, private: true },
    });
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let joined = false;
    let cancelled = false;

    const payload = (active: boolean) => ({
      memberId: currentMember.id,
      name: currentMember.name,
      color: currentMember.color,
      active,
      lastActiveAt: new Date().toISOString(),
    });

    const updateStatus = (status: PresenceStatus) => {
      if (statusRef.current === status) return;
      statusRef.current = status;
      if (joined) void channel.track(payload(status === "active"));
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => updateStatus("idle"), IDLE_AFTER_MS);
    };

    const becomeActive = () => {
      updateStatus("active");
      resetIdleTimer();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") becomeActive();
      else updateStatus("idle");
    };

    /* Private channels authorize against the JWT already attached to
       the realtime socket -- supabase-js sets that from onAuthStateChange,
       which fires asynchronously and can lose the race against this
       effect's own subscribe() on first mount, so the join gets checked
       with no session and is rejected ("Unauthorized ... team-presence")
       even though the user is really signed in. Explicitly fetching the
       session and calling realtime.setAuth() right before subscribing
       closes that race instead of relying on timing. */
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel
        .on("presence", { event: "sync" }, () => setMembers(aggregatePresence(channel.presenceState())))
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setUnavailable(true);
            return;
          }
          if (status !== "SUBSCRIBED") return;
          joined = true;
          void channel.track(payload(statusRef.current === "active"));
          resetIdleTimer();
        });
    })();

    const activityEvents: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "focus"];
    for (const event of activityEvents) window.addEventListener(event, becomeActive, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (idleTimer) clearTimeout(idleTimer);
      for (const event of activityEvents) window.removeEventListener(event, becomeActive);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [currentMember.color, currentMember.id, currentMember.name]);

  const roster = visiblePresence(members, collapsed ? 3 : 5);

  if (unavailable) return null;

  return (
    <section className={cn(collapsed ? "px-1 py-3" : "px-3 py-3")} aria-label="Online now">
      {!collapsed && <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Online now</div>}
      <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "-space-x-2")}>
        {roster.members.map((member) => (
          <HoverLabel key={member.memberId} label={`${member.name} · ${member.status === "active" ? "Online" : "Inactive"}`} side={collapsed ? "right" : "left"}>
            <button
              type="button"
            className={cn("relative flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-sidebar text-[10px] font-semibold text-white shadow-sm", member.status === "idle" && "opacity-45 grayscale")}
            style={{ backgroundColor: member.color || "#64748b" }}
            aria-label={`${member.name} is ${member.status}`}
          >
            {initialsForName(member.name)}
            <span
              aria-hidden="true"
              className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar", member.status === "active" ? "bg-emerald-500" : "bg-slate-400")}
            />
            </button>
          </HoverLabel>
        ))}
        {roster.overflow > 0 && (
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-sidebar bg-muted text-[10px] font-semibold text-muted-foreground"
            aria-label={`${roster.overflow} more team members online`}
            title={`${roster.overflow} more team members online`}
          >
            +{roster.overflow}
          </div>
        )}
      </div>
    </section>
  );
}
