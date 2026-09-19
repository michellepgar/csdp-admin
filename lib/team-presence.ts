export type PresenceStatus = "active" | "idle";

export interface PresencePayload {
  memberId: string;
  name: string;
  color?: string;
  active: boolean;
  lastActiveAt: string;
}

export interface TeamPresenceMember {
  memberId: string;
  name: string;
  color?: string;
  status: PresenceStatus;
}

function isPresencePayload(value: unknown): value is PresencePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.memberId === "string" &&
    payload.memberId.length > 0 &&
    typeof payload.name === "string" &&
    payload.name.length > 0 &&
    typeof payload.active === "boolean" &&
    typeof payload.lastActiveAt === "string" &&
    (payload.color === undefined || typeof payload.color === "string")
  );
}

export function aggregatePresence(state: Record<string, unknown[]>): TeamPresenceMember[] {
  const members = new Map<string, TeamPresenceMember>();

  for (const tabs of Object.values(state)) {
    for (const value of tabs) {
      if (!isPresencePayload(value)) continue;
      const current = members.get(value.memberId);
      if (!current) {
        members.set(value.memberId, {
          memberId: value.memberId,
          name: value.name,
          color: value.color,
          status: value.active ? "active" : "idle",
        });
      } else if (value.active) {
        current.status = "active";
      }
    }
  }

  return [...members.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/* The sidebar's presence channel is the one place that knows who's
   online; it publishes each update here (window event + a remembered
   copy) so other parts of the app -- the Messages page's online dots --
   can show it without opening a second realtime connection. */
export const PRESENCE_EVENT = "team-presence";

type PresenceWindow = Window & { __teamPresence?: TeamPresenceMember[] };

export function publishPresence(members: TeamPresenceMember[]) {
  (window as PresenceWindow).__teamPresence = members;
  window.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail: members }));
}

export function readPublishedPresence(): TeamPresenceMember[] {
  return (window as PresenceWindow).__teamPresence ?? [];
}

export function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

export function visiblePresence(members: TeamPresenceMember[], limit: number) {
  return {
    members: members.slice(0, limit),
    overflow: Math.max(0, members.length - limit),
  };
}
