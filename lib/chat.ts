/* Shared chat types + room-key helpers (no server/client imports, so
   both sides can use them). A room is either "team" (everyone) or
   "dm:A|B" -- the two participants' names, sorted, so both sides always
   compute the same key for the same pair. */

export const TEAM_ROOM = "team";

export interface ChatMessage {
  id: string;
  room: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface ChatRoomSummary {
  unread: number;
  last?: ChatMessage;
}

export interface ChatSummary {
  me: string;
  rooms: Record<string, ChatRoomSummary>;
  totalUnread: number;
}

export const MAX_CHAT_BODY = 2000;

export function dmRoom(a: string, b: string): string {
  return `dm:${[a, b].sort((x, y) => x.localeCompare(y)).join("|")}`;
}

export function dmParticipants(room: string): string[] {
  return room.startsWith("dm:") ? room.slice(3).split("|") : [];
}

/* Same rule the database's chat_can_access() enforces -- checked again
   here so a bad room key is rejected with a clear message instead of a
   silent RLS no-op. */
export function canAccessRoom(room: string, name: string): boolean {
  if (room === TEAM_ROOM) return true;
  const people = dmParticipants(room);
  return people.length === 2 && people.includes(name) && room === dmRoom(people[0], people[1]);
}

export function otherPersonInDm(room: string, me: string): string | undefined {
  return dmParticipants(room).find((n) => n !== me);
}

export function summarizeChat(me: string, messages: ChatMessage[], reads: Record<string, string>): ChatSummary {
  const rooms: Record<string, ChatRoomSummary> = {};
  // Newest first, so the first message seen per room is its latest.
  const sorted = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const m of sorted) {
    const entry = (rooms[m.room] ??= { unread: 0 });
    if (!entry.last) entry.last = m;
    const readAt = reads[m.room] || "";
    if (m.senderName !== me && m.createdAt > readAt) entry.unread += 1;
  }
  return { me, rooms, totalUnread: Object.values(rooms).reduce((n, r) => n + r.unread, 0) };
}
