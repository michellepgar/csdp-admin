"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { fetchAppState } from "@/lib/fetch-app-state";
import { visiblePrivateNotes } from "@/lib/app-state";
import { noteMatches, noteSnippet, searchWords } from "@/lib/private-note-search";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type NoteActionResult = { error: string | null };

export type PrivateNoteHit = { id: string; snippet: string; createdAt: string };

/* Keyword search for the top bar: the notes you can see (yours, or shared with
   you) that contain every word typed, newest first, a few at a time. Runs on
   the server so the whole set of notes never has to be sent to every page. A
   failed search just returns nothing -- it's a convenience, not something to
   interrupt typing with an error. */
export async function searchPrivateNotes(query: string): Promise<PrivateNoteHit[]> {
  const words = searchWords(query);
  if (words.length === 0 || query.length > 200) return [];
  try {
    if (await isDemoMode()) {
      const state = await fetchAppState();
      if (!state) return [];
      return visiblePrivateNotes(state, "Jane")
        .filter((n) => noteMatches(n.text, words))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
        .map((n) => ({ id: n.id, snippet: noteSnippet(n.text, words), createdAt: n.createdAt }));
    }
    const { supabase, me } = await requireTeamMember();
    const { data, error } = await supabase
      .from("private_notes")
      .select("id, text, author, shared_with, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return [];
    return (data ?? [])
      .filter((n) => n.author === me.name || ((n.shared_with as string[] | null) ?? []).includes(me.name))
      .filter((n) => noteMatches(n.text ?? "", words))
      .slice(0, 8)
      .map((n) => ({ id: n.id as string, snippet: noteSnippet(n.text ?? "", words), createdAt: n.created_at as string }));
  } catch (error) {
    console.error("Private note search failed", error);
    return [];
  }
}

/* Pins a private note into "Your Plan" as a plain reminder -- unlike
   task/priority plan_items, this never resolves into a real task; it
   just sits until checked off (completeNoteReminder). label is copied
   from the note's own text at add-time (one-time copy, same as
   resolvePriorityPlanItem's file names -- editing the note afterward
   doesn't change the reminder's label). Returns {error} rather than
   throwing, unlike this file's other actions -- deliberately following
   the newer convention from app/(app)/overview/actions.ts, since this
   touches plan_items (a table whose thrown errors this session has
   repeatedly needed surfaced, not swallowed). */
export async function addNoteToPlan(formData: FormData): Promise<NoteActionResult> {
  const noteId = formData.get("noteId") as string;
  const label = ((formData.get("label") as string) || "").trim() || "Note";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.planItems ??= []).push({ id: `demo-note-plan-${Date.now()}`, kind: "note", vaName: "Jane", noteId, label, createdBy: "Jane", createdAt: new Date().toISOString() });
    });
    revalidatePath("/overview");
    return { error: null };
  }

  try {
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("plan_items").insert({ kind: "note", va_name: me.name, note_id: noteId, label, created_by: me.name });
    if (error) throw new Error(error.message);
    revalidatePath("/overview");
    return { error: null };
  } catch (error) {
    console.error("Add note to plan failed", error);
    return { error: error instanceof Error ? error.message : "Couldn't add this to your plan. Please try again." };
  }
}

/* Checks a note reminder off -- sets completed_at instead of deleting
   the row, so it can still show up as "completed today" on Overview
   (see lib/shared-task-files.ts's todayActivityByVa). */
export async function completeNoteReminder(formData: FormData): Promise<NoteActionResult> {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = (state.planItems || []).find((p) => p.id === id);
      if (item) item.completedAt = new Date().toISOString();
    });
    revalidatePath("/overview");
    return { error: null };
  }

  try {
    const { supabase } = await requireTeamMember();
    const { error } = await supabase.from("plan_items").update({ completed_at: new Date().toISOString() }).eq("id", id).eq("kind", "note");
    if (error) throw new Error(error.message);
    revalidatePath("/overview");
    return { error: null };
  } catch (error) {
    console.error("Complete note reminder failed", error);
    return { error: error instanceof Error ? error.message : "Couldn't check this off. Please try again." };
  }
}

export async function addPrivateNote(formData: FormData) {
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return;
  const text = sanitizeNoteHtml(rawText);
  const padColor = (formData.get("padColor") as string) || undefined;
  const isReminder = formData.get("isReminder") === "on";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.privateNotes ??= []).push({ id: `demo-${Date.now()}`, text, padColor, author: "Jane", sharedWith: [], ackBy: [], createdAt: new Date().toISOString(), isReminder });
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { error } = await supabase.from("private_notes").insert({
    id: crypto.randomUUID(),
    text,
    pad_color: padColor || null,
    author: me.name,
    shared_with: [],
    ack_by: [],
    is_reminder: isReminder,
  });
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Author-only, matching sharePrivateNote/unsharePrivateNote below --
   being shared a note gets you read/ack/delete, never the ability to
   change someone else's own words. */
export async function updatePrivateNote(formData: FormData) {
  const id = formData.get("id") as string;
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return;
  const text = sanitizeNoteHtml(rawText);
  const padColor = (formData.get("padColor") as string) || undefined;
  const isReminder = formData.get("isReminder") === "on";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id && n.author === "Jane");
      if (note) {
        note.text = text;
        note.padColor = padColor;
        note.isReminder = isReminder;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author").eq("id", id).maybeSingle();
  if (!note || note.author !== me.name) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ text, pad_color: padColor || null, is_reminder: isReminder })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function sharePrivateNote(formData: FormData) {
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;
  if (!vaName) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id && n.author === "Jane");
      if (note) {
        note.sharedWith ??= [];
        if (!note.sharedWith.includes(vaName)) note.sharedWith.push(vaName);
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || note.author !== me.name) return;
  const sharedWith: string[] = note.shared_with || [];
  if (sharedWith.includes(vaName)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ shared_with: [...sharedWith, vaName] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function unsharePrivateNote(formData: FormData) {
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id && n.author === "Jane");
      if (note?.sharedWith) note.sharedWith = note.sharedWith.filter((n) => n !== vaName);
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || note.author !== me.name) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ shared_with: ((note.shared_with as string[]) || []).filter((n) => n !== vaName) })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function ackPrivateNote(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (note) {
        note.ackBy ??= [];
        if (!note.ackBy.includes("Jane")) note.ackBy.push("Jane");
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("ack_by").eq("id", id).maybeSingle();
  if (!note) return;
  const ackBy: string[] = note.ack_by || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ ack_by: [...ackBy, me.name] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Same rule as canDeletePrivateNote in lib/app-state.ts (the author
   can always delete their own; once they're off the team, anyone who
   can see it can clean it up), reimplemented as targeted queries
   instead of fetchAppState()'s full ~19-table fetch. */
export async function removePrivateNote(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.privateNotes = (state.privateNotes || []).filter((n) => n.id !== id);
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author").eq("id", id).maybeSingle();
  if (!note) return;

  let canDelete = note.author === me.name;
  if (!canDelete) {
    const { data: authorVa } = await supabase.from("vas").select("id").eq("name", note.author).maybeSingle();
    canDelete = !authorVa;
  }
  if (!canDelete) return;

  const { error } = await supabase.from("private_notes").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* A note is visible to (and thus board-manageable by) its author or
   anyone it's shared with -- same rule as visiblePrivateNotes() in
   lib/app-state.ts. Both people see the same note on their own
   Private Notes page, so either should be able to reposition it on
   their own board. */
function canManageBoardState(note: { author: string; shared_with: string[] | null }, currentName: string) {
  return note.author === currentName || (note.shared_with || []).includes(currentName);
}

/* Pins a note to the board, appending it to the end of the current
   left-to-right order. board_z is reused here as a pure sequence
   number (not a stacking z-index -- freeform positioning was dropped
   in favor of an ordered left-to-right layout you rearrange with the
   board's Reorder mode). board_x is set to a fixed sentinel (0) purely
   so "is this note on the board" (board_x non-null) still holds; its
   value is never read for layout. board_rotation used to keep a small
   randomized tilt for visual character -- Michelle asked for pinned
   notes to just sit straight instead, so this always writes 0 now
   (components/private-notes-board.tsx also stopped reading the stored
   value, so an old note with a leftover nonzero tilt renders straight
   too, not just newly-pinned ones). */
export async function pinPrivateNote(id: string) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (!note) return;
      const maxZ = Math.max(0, ...(state.privateNotes || []).map((n) => n.boardZ || 0));
      note.boardX = 0;
      note.boardRotation = 0;
      note.boardZ = maxZ + 1;
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { data: maxZRow } = await supabase
    .from("private_notes")
    .select("board_z")
    .not("board_z", "is", null)
    .order("board_z", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextZ = (maxZRow?.board_z || 0) + 1;

  const { error } = await supabase.from("private_notes").update({ board_x: 0, board_rotation: 0, board_z: nextZ }).eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

// Clamp shared with the client-side drag handler in
// components/private-notes-board.tsx so a stale/tampered value posted
// straight to this action still lands in the same sane range.
const MIN_BOARD_NOTE_WIDTH = 140;
const MAX_BOARD_NOTE_WIDTH = 640;
const MIN_BOARD_NOTE_HEIGHT = 80;
const MAX_BOARD_NOTE_HEIGHT = 640;

/* Sets a pinned note's own width, overriding the board's normal fixed
   card width -- Michelle asked to be able to stretch a note sideways
   (board_width already existed as a column/field, left over from the
   earlier freeform Moveable board that stored it too, just unused
   since nothing wrote to it or read it for layout until now). */
export async function resizePinnedNoteWidth(id: string, width: number) {
  const clamped = Math.round(Math.max(MIN_BOARD_NOTE_WIDTH, Math.min(MAX_BOARD_NOTE_WIDTH, width)));

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (note) note.boardWidth = clamped;
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { error } = await supabase.from("private_notes").update({ board_width: clamped }).eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Same as resizePinnedNoteWidth, for board_height -- Michelle asked
   for height to be adjustable too, not just width. When a note has an
   explicit height set, the card switches to overflow-y: auto (see
   components/private-notes-board.tsx) so a height shorter than its
   content scrolls inside the card instead of clipping or overflowing
   into whatever's below it on the board. */
export async function resizePinnedNoteHeight(id: string, height: number) {
  const clamped = Math.round(Math.max(MIN_BOARD_NOTE_HEIGHT, Math.min(MAX_BOARD_NOTE_HEIGHT, height)));

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (note) note.boardHeight = clamped;
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { error } = await supabase.from("private_notes").update({ board_height: clamped }).eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Reassigns the left-to-right order of every pinned note -- same
   pattern as reorderChecklistTemplate in app/(app)/schools/[id]/actions.ts:
   each id's position in the array becomes its new board_z. */
export async function reorderPinnedNotes(orderedIds: string[]) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const byId = new Map((state.privateNotes || []).map((n) => [n.id, n]));
      orderedIds.forEach((id, i) => {
        const note = byId.get(id);
        if (note) note.boardZ = i;
      });
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase } = await requireTeamMember();

  await Promise.all(orderedIds.map((id, i) => supabase.from("private_notes").update({ board_z: i }).eq("id", id)));
  revalidatePath("/private-notes");
}

/* Returns a note from the board to the ordinary list by clearing all
   six board columns -- this is the "Unpin" menu action. */
export async function unpinPrivateNote(id: string) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (note) {
        note.boardX = undefined;
        note.boardY = undefined;
        note.boardRotation = undefined;
        note.boardWidth = undefined;
        note.boardHeight = undefined;
        note.boardZ = undefined;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ board_x: null, board_y: null, board_rotation: null, board_width: null, board_height: null, board_z: null })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Visible to, and postable by, only the note's author and whoever
   it's shared with -- same access rule as the note itself
   (canManageBoardState above). Unlike Issue/General Note comments,
   this does NOT record a mentions row even if the text contains an
   @name -- Private Notes are explicitly out of scope for mention
   notifications (see docs/superpowers/specs/2026-09-18-comment-
   redesign-mentions-notifications-design.md's Scope section); the
   rich CommentComposer still autocompletes and styles a typed mention,
   it just doesn't notify anyone. */
export async function addPrivateNoteComment(formData: FormData) {
  const noteId = formData.get("noteId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === noteId && (n.author === "Jane" || (n.sharedWith || []).includes("Jane")));
      if (!note) return;
      (note.comments ??= []).push({ id: `demo-${Date.now()}`, author: "Jane", text: sanitizeNoteHtml(text, state.vas || []), createdAt: new Date().toISOString() });
      note.commentAckBy = ["Jane"];
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", noteId).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const html = sanitizeNoteHtml(text, vasData || []);

  const { error } = await supabase.from("private_note_comments").insert({ id: crypto.randomUUID(), note_id: noteId, author: me.name, text: html });
  orThrow(error);
  const { error: ackError } = await supabase.from("private_notes").update({ comment_ack_by: [me.name] }).eq("id", noteId);
  orThrow(ackError);
  revalidatePath("/private-notes");
}

/* Author-only, matching every other edit rule in this app. */
export async function editPrivateNoteComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const note of state.privateNotes || []) {
        const comment = (note.comments || []).find((c) => c.id === commentId);
        if (!comment || comment.author !== "Jane") continue;
        comment.text = sanitizeNoteHtml(text, state.vas || []);
        comment.editedAt = new Date().toISOString();
        return;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("private_note_comments").select("author").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const html = sanitizeNoteHtml(text, vasData || []);

  const { error } = await supabase.from("private_note_comments").update({ text: html, edited_at: new Date().toISOString() }).eq("id", commentId);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function removePrivateNoteComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const note of state.privateNotes || []) {
        const before = (note.comments || []).length;
        note.comments = (note.comments || []).filter((c) => !(c.id === commentId && c.author === "Jane"));
        if (note.comments.length !== before) return;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("private_note_comments").select("author").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { error } = await supabase.from("private_note_comments").delete().eq("id", commentId);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function ackPrivateNoteComments(formData: FormData) {
  const noteId = formData.get("noteId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === noteId);
      if (!note) return;
      note.commentAckBy ??= [];
      if (!note.commentAckBy.includes("Jane")) note.commentAckBy.push("Jane");
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("comment_ack_by").eq("id", noteId).maybeSingle();
  if (!note) return;
  const ackBy: string[] = note.comment_ack_by || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase.from("private_notes").update({ comment_ack_by: [...ackBy, me.name] }).eq("id", noteId);
  orThrow(error);
  revalidatePath("/private-notes");
}
