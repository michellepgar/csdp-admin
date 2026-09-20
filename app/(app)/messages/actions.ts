"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { addGeneralNote } from "@/app/(app)/notes/actions";
import { addPriority } from "@/app/(app)/overview/actions";
import { isDemoMode, demoMutate, getDemoState } from "@/lib/demo-session";
import {
  ATTACHMENT_RETENTION_DAYS,
  attachmentTypeOf,
  canAccessRoom,
  CHAT_ATTACHMENT_BUCKET,
  MAX_CHAT_BODY,
  summarizeChat,
  validateAttachment,
  type ChatAttachment,
  type ChatMessage,
  type ChatSummary,
} from "@/lib/chat";

const DEMO_ME = "Jane";
// The demo keeps its whole state in cookies (a few KB), so its chat log
// is trimmed to the newest few rather than growing without bound.
const DEMO_MAX_MESSAGES = 40;
const FETCH_LIMIT = 200;
// How many recent messages the unread summary looks at -- plenty for a
// small team, and keeps the poll to one small query.
const SUMMARY_WINDOW = 400;

const MESSAGE_COLUMNS = "id, room, sender_name, body, created_at, attachment_path, attachment_name, attachment_type, attachment_size, attachment_expired, attachment_removed";

type MessageRow = {
  id: string;
  room: string;
  sender_name: string;
  body: string;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  attachment_expired: boolean | null;
  attachment_removed: boolean | null;
};

function fromRow(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    room: r.room,
    senderName: r.sender_name,
    body: r.body,
    createdAt: r.created_at,
    attachment: r.attachment_path
      ? {
          path: r.attachment_path,
          name: r.attachment_name ?? "file",
          type: r.attachment_type ?? "",
          size: Number(r.attachment_size ?? 0),
          expired: !!r.attachment_expired,
          removed: !!r.attachment_removed,
        }
      : undefined,
  };
}

/* Every action here returns plain data (never throws for an expected
   problem) -- a thrown error inside a Server Action is redacted in
   production, so the chat UI couldn't show why a send failed. */

export async function sendChatMessage(
  room: string,
  rawBody: string,
  attachment?: { path: string; name: string; type: string; size: number },
): Promise<{ error: string | null; message?: ChatMessage }> {
  const body = (rawBody || "").trim();
  if (!body && !attachment) return { error: "Type a message first." };
  if (body.length > MAX_CHAT_BODY) return { error: `Messages can be up to ${MAX_CHAT_BODY} characters.` };
  let attachmentInfo: ChatAttachment | undefined;
  if (attachment) {
    const type = attachmentTypeOf(attachment.name, attachment.type);
    const problem = validateAttachment(attachment.name, type, attachment.size);
    if (problem) return { error: problem };
    attachmentInfo = { path: attachment.path, name: attachment.name.slice(0, 200), type, size: attachment.size };
  }

  if (await isDemoMode()) {
    if (!canAccessRoom(room, DEMO_ME)) return { error: "You can't post in that chat." };
    const message: ChatMessage = { id: `demo-chat-${Date.now()}`, room, senderName: DEMO_ME, body, createdAt: new Date().toISOString(), attachment: attachmentInfo };
    await demoMutate((state) => {
      state.chatMessages = [...(state.chatMessages || []), message].slice(-DEMO_MAX_MESSAGES);
    });
    return { error: null, message };
  }

  try {
    const { supabase, me } = await requireTeamMember();
    if (!canAccessRoom(room, me.name)) return { error: "You can't post in that chat." };
    if (attachmentInfo) {
      // The file must be one this person uploaded to their own folder --
      // the storage policy only lets them write there, this stops a
      // message pointing at somebody else's file.
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !attachmentInfo.path.startsWith(`${userData.user.id}/`)) {
        return { error: "That attachment couldn't be verified. Try attaching it again." };
      }
    }
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room,
        sender_name: me.name,
        body,
        ...(attachmentInfo
          ? { attachment_path: attachmentInfo.path, attachment_name: attachmentInfo.name, attachment_type: attachmentInfo.type, attachment_size: attachmentInfo.size }
          : {}),
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) return { error: "Couldn't send that message. Try again." };
    return { error: null, message: fromRow(data as MessageRow) };
  } catch {
    return { error: "Couldn't send that message. Try again." };
  }
}

export async function fetchChatMessages(room: string): Promise<{ messages: ChatMessage[]; error: string | null }> {
  if (await isDemoMode()) {
    if (!canAccessRoom(room, DEMO_ME)) return { messages: [], error: "You can't open that chat." };
    const state = await getDemoState();
    const messages = (state.chatMessages || []).filter((m) => m.room === room).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { messages, error: null };
  }

  try {
    const { supabase, me } = await requireTeamMember();
    if (!canAccessRoom(room, me.name)) return { messages: [], error: "You can't open that chat." };
    const { data, error } = await supabase
      .from("chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("room", room)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (error) return { messages: [], error: "Couldn't load messages." };
    return { messages: (data as MessageRow[]).map(fromRow).reverse(), error: null };
  } catch {
    return { messages: [], error: "Couldn't load messages." };
  }
}

export async function markChatRead(room: string): Promise<void> {
  try {
    if (await isDemoMode()) {
      if (!canAccessRoom(room, DEMO_ME)) return;
      await demoMutate((state) => {
        (state.chatReads ??= {})[room] = new Date().toISOString();
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    if (!canAccessRoom(room, me.name)) return;
    await supabase.from("chat_reads").upsert({ reader_name: me.name, room, last_read_at: new Date().toISOString() }, { onConflict: "reader_name,room" });
  } catch {
    // A missed read marker just leaves the badge up until the next open.
  }
}

/* Per-room unread counts + the latest message in each room, for the
   sidebar badge, the room list, and the new-message pop-up. Returns
   null on any failure so a poll just skips that tick. */
export async function getChatSummary(): Promise<ChatSummary | null> {
  try {
    if (await isDemoMode()) {
      const state = await getDemoState();
      return summarizeChat(DEMO_ME, state.chatMessages || [], state.chatReads || {});
    }
    const { supabase, me } = await requireTeamMember();
    const [messagesResult, readsResult] = await Promise.all([
      supabase
        .from("chat_messages")
        .select(MESSAGE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(SUMMARY_WINDOW),
      supabase.from("chat_reads").select("room, last_read_at").eq("reader_name", me.name),
    ]);
    if (messagesResult.error || readsResult.error) return null;
    const reads: Record<string, string> = {};
    for (const r of readsResult.data || []) reads[r.room] = r.last_read_at;
    return summarizeChat(me.name, (messagesResult.data as MessageRow[]).map(fromRow), reads);
  } catch {
    return null;
  }
}

/* Signed, short-lived links for showing attachments (photo previews).
   Created under the caller's own session, so the storage policy decides
   what they may see -- a file from a chat you're not in simply gets no
   link. Demo mode has no stored files. */
export async function getChatAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  const wanted = Array.from(new Set(paths)).slice(0, 60);
  if (wanted.length === 0) return {};
  try {
    if (await isDemoMode()) return {};
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUrls(wanted, 60 * 60);
    if (error || !data) return {};
    const urls: Record<string, string> = {};
    for (const item of data) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    }
    return urls;
  } catch {
    return {};
  }
}

/* A link that makes the browser SAVE the file to the person's device
   (with its original name) instead of opening it -- the way people keep
   an attachment before it expires. */
export async function getChatAttachmentDownloadUrl(path: string, filename: string): Promise<{ url: string | null; error: string | null }> {
  try {
    if (await isDemoMode()) return { url: null, error: "Downloads aren't available in the demo." };
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUrl(path, 120, { download: filename });
    if (error || !data) return { url: null, error: "That file is no longer available." };
    return { url: data.signedUrl, error: null };
  } catch {
    return { url: null, error: "Couldn't prepare the download. Try again." };
  }
}

/* Retention: attachments are deleted ATTACHMENT_RETENTION_DAYS after they
   were sent. The database marks the messages expired and returns the
   file paths; this removes the files themselves. Called quietly by the
   Messages nav (at most about once a day per browser) -- no scheduler
   needed. Safe to run repeatedly and from several people at once. */
export async function purgeExpiredChatAttachments(): Promise<number> {
  try {
    if (await isDemoMode()) return 0;
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.rpc("chat_expire_attachments", { p_days: ATTACHMENT_RETENTION_DAYS });
    if (error || !data || (data as string[]).length === 0) return 0;
    const paths = data as string[];
    await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove(paths);
    return paths.length;
  } catch {
    return 0;
  }
}

/* The sender deletes their own attachment early, for everyone in the
   chat. The database only allows it for the message's sender; the
   message stays and shows that the file was deleted. */
export async function removeChatAttachment(messageId: string): Promise<{ error: string | null; message?: ChatMessage }> {
  try {
    if (await isDemoMode()) {
      const result: { message?: ChatMessage } = {};
      await demoMutate((state) => {
        const found = (state.chatMessages || []).find((m) => m.id === messageId);
        if (found && found.senderName === DEMO_ME && found.attachment) {
          found.attachment = { ...found.attachment, expired: true, removed: true };
          result.message = found;
        }
      });
      return result.message ? { error: null, message: result.message } : { error: "You can only delete files you sent." };
    }
    const { supabase } = await requireTeamMember();
    const { data: path, error } = await supabase.rpc("chat_remove_attachment", { p_message_id: messageId });
    if (error || !path) return { error: "You can only delete files you sent." };
    await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([path as string]);
    const { data } = await supabase.from("chat_messages").select(MESSAGE_COLUMNS).eq("id", messageId).maybeSingle();
    return { error: null, message: data ? fromRow(data as MessageRow) : undefined };
  } catch {
    return { error: "Couldn't delete that file. Try again." };
  }
}

/* Send a chat message's text on to General Notes or Task Priorities, so
   nobody retypes it. The text is read from the message itself on the
   server (through the same access rules as the chat), never taken from
   the browser, so a note's "From <name>" line can't be forged. Photos and
   files aren't copied -- only text. */
async function readOwnAccessibleMessage(messageId: string): Promise<{ message?: ChatMessage; error?: string }> {
  if (await isDemoMode()) {
    const state = await getDemoState();
    const found = (state.chatMessages || []).find((m) => m.id === messageId);
    return found ? { message: found } : { error: "That message isn't available." };
  }
  const { supabase } = await requireTeamMember();
  const { data } = await supabase.from("chat_messages").select(MESSAGE_COLUMNS).eq("id", messageId).maybeSingle();
  return data ? { message: fromRow(data as MessageRow) } : { error: "That message isn't available." };
}

function escapeChatHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function addChatMessageToGeneralNotes(messageId: string): Promise<{ error: string | null }> {
  try {
    const { message, error } = await readOwnAccessibleMessage(messageId);
    if (!message) return { error: error ?? "That message isn't available." };
    if (!message.body.trim()) return { error: "Only text can be added to General Notes." };

    const when = new Date(message.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
    const where = message.room === "team" ? "Team chat" : "chat";
    const html = `${escapeChatHtml(message.body.trim()).replace(/\n/g, "<br>")}<br><br><i>From ${escapeChatHtml(message.senderName)} in ${where} · ${when}</i>`;

    const formData = new FormData();
    formData.set("text", html);
    await addGeneralNote(formData);
    revalidatePath("/notes");
    return { error: null };
  } catch {
    return { error: "Couldn't add that to General Notes. Try again." };
  }
}

export async function addChatMessageToPriorities(messageId: string): Promise<{ error: string | null }> {
  try {
    const { message, error } = await readOwnAccessibleMessage(messageId);
    if (!message) return { error: error ?? "That message isn't available." };
    const label = message.body.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!label) return { error: "Only text can be added to Task Priorities." };

    const formData = new FormData();
    formData.set("label", label);
    const result = await addPriority(formData);
    if (result.error) return { error: result.error === "Not authorized" ? "Only admins can add Task Priorities." : result.error };
    revalidatePath("/overview");
    return { error: null };
  } catch {
    return { error: "Couldn't add that to Task Priorities. Try again." };
  }
}
