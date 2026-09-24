"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { extractMentionedNames, snippetFromHtml } from "@/lib/mentions";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type NoteActionResult = { error: string | null };

// The composer only clears itself (and its saved draft) once this
// confirms success -- clearing on the raw browser "submit" event
// instead (the old behavior) wiped a VA's just-written note the moment
// Add was clicked, even if the save itself then failed.
/* A note's pad color: any #RRGGBB color (a preset swatch or one picked with "More colors"). */
function readPadColor(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
}

export async function addGeneralNote(formData: FormData): Promise<NoteActionResult> {
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return { error: null };
  const padColor = readPadColor(formData.get("padColor"));
  const urgency = formData.get("urgent") ? "Urgent" : "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const text = sanitizeNoteHtml(rawText, state.vas || []);
      const id = `demo-${Date.now()}`;
      (state.generalNotes ??= []).push({ id, text, padColor, author: "Jane", urgency: (urgency || "") as "Urgent" | "", ackBy: [], createdAt: new Date().toISOString() });
      const mentioned = extractMentionedNames(snippetFromHtml(rawText), (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane");
      for (const name of mentioned) {
        (state.mentions ??= []).push({
          id: `demo-${Date.now()}-${name}`,
          mentionedName: name,
          mentionerName: "Jane",
          source: "general_note",
          noteId: id,
          snippet: snippetFromHtml(rawText),
          createdAt: new Date().toISOString(),
        });
      }
    });
    revalidatePath("/notes");
    return { error: null };
  }

  try {
    const { supabase, me } = await requireTeamMember();

    const { data: vasData } = await supabase.from("vas").select("name, color");
    const roster = vasData || [];
    const text = sanitizeNoteHtml(rawText, roster);
    const id = crypto.randomUUID();

    const { error } = await supabase.from("general_notes").insert({
      id,
      text,
      pad_color: padColor || null,
      author: me.name,
      urgency: urgency || null,
      ack_by: [],
    });
    orThrow(error);

    const mentioned = extractMentionedNames(snippetFromHtml(rawText), roster.map((v) => v.name)).filter((n) => n !== me.name);
    if (mentioned.length > 0) {
      const { error: mentionsError } = await supabase.from("mentions").insert(
        mentioned.map((name) => ({
          id: crypto.randomUUID(),
          mentioned_name: name,
          mentioner_name: me.name,
          source: "general_note",
          note_id: id,
          snippet: snippetFromHtml(rawText),
        }))
      );
      orThrow(mentionsError);
    }

    revalidatePath("/notes");
    return { error: null };
  } catch (error) {
    console.error("Add general note failed", error);
    return { error: error instanceof Error ? error.message : "The note could not be saved. Please try again." };
  }
}

/* Strictly the note's own author, no exception -- unlike
   removeGeneralNote below (which lets an admin clean up after someone
   leaves the team), Michelle asked for editing to be author-only,
   full stop: nobody else should ever be able to change what someone
   else wrote, admin or not. */
export async function updateGeneralNote(formData: FormData) {
  const id = formData.get("id") as string;
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return;
  const padColor = readPadColor(formData.get("padColor"));
  const urgency = formData.get("urgent") ? "Urgent" : "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.generalNotes || []).find((n) => n.id === id);
      if (!note || note.author !== "Jane") return;
      note.text = sanitizeNoteHtml(rawText, state.vas || []);
      note.padColor = padColor;
      note.urgency = (urgency || "") as "Urgent" | "";
      const alreadyMentioned = new Set((state.mentions || []).filter((m) => m.noteId === id).map((m) => m.mentionedName));
      const mentioned = extractMentionedNames(snippetFromHtml(rawText), (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane" && !alreadyMentioned.has(n));
      for (const name of mentioned) {
        (state.mentions ??= []).push({
          id: `demo-${Date.now()}-${name}`,
          mentionedName: name,
          mentionerName: "Jane",
          source: "general_note",
          noteId: id,
          snippet: snippetFromHtml(rawText),
          createdAt: new Date().toISOString(),
        });
      }
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("general_notes").select("author").eq("id", id).maybeSingle();
  if (!note || note.author !== me.name) return;

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const roster = vasData || [];
  const text = sanitizeNoteHtml(rawText, roster);

  const { error } = await supabase
    .from("general_notes")
    .update({ text, pad_color: padColor || null, urgency: urgency || null })
    .eq("id", id);
  orThrow(error);

  const { data: existingMentions } = await supabase.from("mentions").select("mentioned_name").eq("note_id", id);
  const alreadyMentioned = new Set((existingMentions || []).map((m) => m.mentioned_name));
  const mentioned = extractMentionedNames(snippetFromHtml(rawText), roster.map((v) => v.name)).filter((n) => n !== me.name && !alreadyMentioned.has(n));
  if (mentioned.length > 0) {
    const { error: mentionsError } = await supabase.from("mentions").insert(
      mentioned.map((name) => ({
        id: crypto.randomUUID(),
        mentioned_name: name,
        mentioner_name: me.name,
        source: "general_note",
        note_id: id,
        snippet: snippetFromHtml(rawText),
      }))
    );
    orThrow(mentionsError);
  }

  revalidatePath("/notes");
}

export async function ackGeneralNote(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.generalNotes || []).find((n) => n.id === id);
      if (note) {
        note.ackBy ??= [];
        if (!note.ackBy.includes("Jane")) note.ackBy.push("Jane");
      }
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("general_notes").select("ack_by").eq("id", id).maybeSingle();
  if (!note) return;
  const ackBy: string[] = note.ack_by || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase
    .from("general_notes")
    .update({ ack_by: [...ackBy, me.name] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/notes");
}

/* Same rule as canDeleteGeneralNote in lib/app-state.ts (the author
   can always delete their own; once they're off the team, only an
   admin can), reimplemented as targeted queries instead of
   fetchAppState()'s full ~19-table fetch. */
export async function removeGeneralNote(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.generalNotes || []).find((n) => n.id === id);
      if (!note) return;
      const authorStillOnTeam = state.vas.some((v) => v.name === note.author);
      const me = state.vas.find((v) => v.name === "Jane");
      const canDelete = note.author === "Jane" || (!authorStillOnTeam && !!me && isAdmin(me));
      if (!canDelete) return;
      state.generalNotes = (state.generalNotes || []).filter((n) => n.id !== id);
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("general_notes").select("author").eq("id", id).maybeSingle();
  if (!note) return;

  let canDelete = note.author === me.name;
  if (!canDelete) {
    const { data: authorVa } = await supabase.from("vas").select("id").eq("name", note.author).maybeSingle();
    const authorStillOnTeam = !!authorVa;
    canDelete = !authorStillOnTeam && isAdmin(me);
  }
  if (!canDelete) return;

  const { error } = await supabase.from("general_notes").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/notes");
}

/* A comment thread per General Note, same pattern as Issues &
   Concerns' issue_comments -- comment_ack_by resets to just the
   poster's own name on every new comment (blinking dot for everyone
   else), independent of the note's own Urgent/ack_by mechanism. */
export async function addGeneralNoteComment(formData: FormData) {
  const noteId = formData.get("noteId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.generalNotes || []).find((n) => n.id === noteId);
      if (!note) return;
      (note.comments ??= []).push({ id: `demo-${Date.now()}`, author: "Jane", text: sanitizeNoteHtml(text, state.vas || []), createdAt: new Date().toISOString() });
      note.commentAckBy = ["Jane"];
      const mentioned = extractMentionedNames(text, (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane");
      for (const name of mentioned) {
        (state.mentions ??= []).push({
          id: `demo-${Date.now()}-${name}`,
          mentionedName: name,
          mentionerName: "Jane",
          source: "general_note",
          noteId,
          snippet: snippetFromHtml(text),
          createdAt: new Date().toISOString(),
        });
      }
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const roster = vasData || [];
  const html = sanitizeNoteHtml(text, roster);

  const { error } = await supabase.from("general_note_comments").insert({ id: crypto.randomUUID(), note_id: noteId, author: me.name, text: html });
  orThrow(error);
  const { error: ackError } = await supabase.from("general_notes").update({ comment_ack_by: [me.name] }).eq("id", noteId);
  orThrow(ackError);

  const mentioned = extractMentionedNames(snippetFromHtml(text), roster.map((v) => v.name)).filter((n) => n !== me.name);
  if (mentioned.length > 0) {
    const { error: mentionsError } = await supabase.from("mentions").insert(
      mentioned.map((name) => ({
        id: crypto.randomUUID(),
        mentioned_name: name,
        mentioner_name: me.name,
        source: "general_note",
        note_id: noteId,
        snippet: snippetFromHtml(text),
      }))
    );
    orThrow(mentionsError);
  }

  revalidatePath("/notes");
}

/* Author-only, matching every other edit rule in this app. */
export async function editGeneralNoteComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const note of state.generalNotes || []) {
        const comment = (note.comments || []).find((c) => c.id === commentId);
        if (!comment || comment.author !== "Jane") continue;
        const alreadyMentioned = new Set((state.mentions || []).filter((m) => m.noteId === note.id).map((m) => m.mentionedName));
        comment.text = sanitizeNoteHtml(text, state.vas || []);
        comment.editedAt = new Date().toISOString();
        const mentioned = extractMentionedNames(text, (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane" && !alreadyMentioned.has(n));
        for (const name of mentioned) {
          (state.mentions ??= []).push({
            id: `demo-${Date.now()}-${name}`,
            mentionedName: name,
            mentionerName: "Jane",
            source: "general_note",
            noteId: note.id,
            snippet: snippetFromHtml(text),
            createdAt: new Date().toISOString(),
          });
        }
        return;
      }
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("general_note_comments").select("author, note_id").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const roster = vasData || [];
  const html = sanitizeNoteHtml(text, roster);

  const { error } = await supabase.from("general_note_comments").update({ text: html, edited_at: new Date().toISOString() }).eq("id", commentId);
  orThrow(error);

  const { data: existingMentions } = await supabase.from("mentions").select("mentioned_name").eq("note_id", comment.note_id);
  const alreadyMentioned = new Set((existingMentions || []).map((m) => m.mentioned_name));
  const mentioned = extractMentionedNames(snippetFromHtml(text), roster.map((v) => v.name)).filter((n) => n !== me.name && !alreadyMentioned.has(n));
  if (mentioned.length > 0) {
    const { error: mentionsError } = await supabase.from("mentions").insert(
      mentioned.map((name) => ({
        id: crypto.randomUUID(),
        mentioned_name: name,
        mentioner_name: me.name,
        source: "general_note",
        note_id: comment.note_id,
        snippet: snippetFromHtml(text),
      }))
    );
    orThrow(mentionsError);
  }

  revalidatePath("/notes");
}

export async function removeGeneralNoteComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const note of state.generalNotes || []) {
        const before = (note.comments || []).length;
        note.comments = (note.comments || []).filter((c) => !(c.id === commentId && c.author === "Jane"));
        if (note.comments.length !== before) return;
      }
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("general_note_comments").select("author").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { error } = await supabase.from("general_note_comments").delete().eq("id", commentId);
  orThrow(error);
  revalidatePath("/notes");
}

export async function ackGeneralNoteComments(formData: FormData) {
  const noteId = formData.get("noteId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.generalNotes || []).find((n) => n.id === noteId);
      if (!note) return;
      note.commentAckBy ??= [];
      if (!note.commentAckBy.includes("Jane")) note.commentAckBy.push("Jane");
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("general_notes").select("comment_ack_by").eq("id", noteId).maybeSingle();
  if (!note) return;
  const ackBy: string[] = note.comment_ack_by || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase.from("general_notes").update({ comment_ack_by: [...ackBy, me.name] }).eq("id", noteId);
  orThrow(error);
  revalidatePath("/notes");
}
