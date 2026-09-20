/* Shared chat types + room-key helpers (no server/client imports, so
   both sides can use them). A room is either "team" (everyone) or
   "dm:A|B" -- the two participants' names, sorted, so both sides always
   compute the same key for the same pair. */

export const TEAM_ROOM = "team";

export interface ChatAttachment {
  /** Object path inside the private chat-attachments bucket. */
  path: string;
  name: string;
  type: string;
  size: number;
  /** True once the file is gone -- either the retention period passed or the sender deleted it. */
  expired?: boolean;
  /** True when the sender deleted it early (rather than it expiring). */
  removed?: boolean;
}

export interface ChatMessage {
  id: string;
  room: string;
  senderName: string;
  /** May be empty when the message is just an attachment. */
  body: string;
  createdAt: string;
  attachment?: ChatAttachment;
}

/* Attachments: photos and documents, capped in size, deleted after a
   retention period (people download what they want to keep). Kept in
   step with supabase/phase54_chat_attachments.sql (the bucket's own size
   limit and allowed types) -- the database is the real gate; these
   checks just give a friendly message before uploading. */
export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_RETENTION_DAYS = 14;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

export const ALLOWED_ATTACHMENT_TYPES = Array.from(new Set(Object.values(EXTENSION_TYPES)));

/* The file's MIME type, falling back to its extension when the browser
   gives none (common for .csv/.docx on some systems). */
export function attachmentTypeOf(name: string, mime: string): string {
  if (mime && ALLOWED_ATTACHMENT_TYPES.includes(mime)) return mime;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? mime;
}

/* Whole days left before an attachment sent at `sentAt` is deleted
   (0 = it goes today, negative = already past). Rounded UP, so a file
   sent 13 days and 2 hours ago still reads "1 day left". */
export function attachmentDaysLeft(sentAt: string, now: number = Date.now()): number {
  const deletesAt = new Date(sentAt).getTime() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.ceil((deletesAt - now) / (24 * 60 * 60 * 1000));
}

export function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

/* Only formats every browser can show inline get a picture preview; an
   iPhone HEIC (Chrome/Firefox can't draw it) is offered as a file card. */
export function isPreviewableImage(type: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type);
}

export function validateAttachment(name: string, mime: string, size: number): string | null {
  if (size <= 0) return "That file is empty.";
  if (size > MAX_ATTACHMENT_BYTES) return "Files can be up to 10 MB.";
  if (!ALLOWED_ATTACHMENT_TYPES.includes(attachmentTypeOf(name, mime))) {
    return "You can attach photos, PDFs, Word, Excel, CSV or text files.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* One-line text for a message in lists and pop-ups -- the words if
   there are any, otherwise what was attached. */
export function messagePreview(message: ChatMessage): string {
  if (message.body) return message.body;
  if (!message.attachment) return "";
  return isImageType(message.attachment.type) ? "Sent a photo" : `Sent ${message.attachment.name}`;
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

/* Which chat the floating chat window currently has open (or null when
   it's closed) -- the Messages nav reads this so it doesn't pop up a
   toast for a message you're already looking at. Browser-only; a plain
   window property, nothing persisted. */
type ChatWindow = Window & { __floatingChatRoom?: string | null };

export function setFloatingChatRoom(room: string | null) {
  (window as ChatWindow).__floatingChatRoom = room;
}

export function getFloatingChatRoom(): string | null {
  return (window as ChatWindow).__floatingChatRoom ?? null;
}
