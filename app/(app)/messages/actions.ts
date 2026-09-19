"use server";

import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate, getDemoState } from "@/lib/demo-session";
import { canAccessRoom, MAX_CHAT_BODY, summarizeChat, type ChatMessage, type ChatSummary } from "@/lib/chat";

const DEMO_ME = "Jane";
// The demo keeps its whole state in cookies (a few KB), so its chat log
// is trimmed to the newest few rather than growing without bound.
const DEMO_MAX_MESSAGES = 40;
const FETCH_LIMIT = 200;
// How many recent messages the unread summary looks at -- plenty for a
// small team, and keeps the poll to one small query.
const SUMMARY_WINDOW = 400;

type MessageRow = { id: string; room: string; sender_name: string; body: string; created_at: string };

function fromRow(r: MessageRow): ChatMessage {
  return { id: r.id, room: r.room, senderName: r.sender_name, body: r.body, createdAt: r.created_at };
}

/* Every action here returns plain data (never throws for an expected
   problem) -- a thrown error inside a Server Action is redacted in
   production, so the chat UI couldn't show why a send failed. */

export async function sendChatMessage(room: string, rawBody: string): Promise<{ error: string | null; message?: ChatMessage }> {
  const body = (rawBody || "").trim();
  if (!body) return { error: "Type a message first." };
  if (body.length > MAX_CHAT_BODY) return { error: `Messages can be up to ${MAX_CHAT_BODY} characters.` };

  if (await isDemoMode()) {
    if (!canAccessRoom(room, DEMO_ME)) return { error: "You can't post in that chat." };
    const message: ChatMessage = { id: `demo-chat-${Date.now()}`, room, senderName: DEMO_ME, body, createdAt: new Date().toISOString() };
    await demoMutate((state) => {
      state.chatMessages = [...(state.chatMessages || []), message].slice(-DEMO_MAX_MESSAGES);
    });
    return { error: null, message };
  }

  try {
    const { supabase, me } = await requireTeamMember();
    if (!canAccessRoom(room, me.name)) return { error: "You can't post in that chat." };
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ room, sender_name: me.name, body })
      .select("id, room, sender_name, body, created_at")
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
      .select("id, room, sender_name, body, created_at")
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
        .select("id, room, sender_name, body, created_at")
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
