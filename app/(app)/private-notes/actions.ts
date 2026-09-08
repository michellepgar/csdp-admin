"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addPrivateNote(formData: FormData) {
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return;
  const text = sanitizeNoteHtml(rawText);
  const padColor = (formData.get("padColor") as string) || undefined;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.privateNotes ??= []).push({ id: `demo-${Date.now()}`, text, padColor, author: "Jane", sharedWith: [], ackBy: [], createdAt: new Date().toISOString() });
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
  });
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

/* Pins a note to the board at the given coordinates: sets its
   position, gives it a small randomized tilt so pinned notes don't
   look robotically aligned, and brings it to the front (highest
   board_z among ALL private_notes rows -- simplest to compute, and
   correct regardless of which subset of notes any one viewer can
   actually see, since z-index only ever matters relative to what's
   rendered together in one person's own board). */
export async function pinPrivateNote(id: string, x: number, y: number) {
  const rotation = Math.random() * 12 - 6; // -6..6 degrees

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (!note) return;
      const maxZ = Math.max(0, ...(state.privateNotes || []).map((n) => n.boardZ || 0));
      note.boardX = x;
      note.boardY = y;
      note.boardRotation = rotation;
      note.boardWidth = undefined;
      note.boardHeight = undefined;
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

  const { error } = await supabase
    .from("private_notes")
    .update({ board_x: x, board_y: y, board_rotation: rotation, board_width: null, board_height: null, board_z: nextZ })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Flexible updater for everything that can happen to a note ONCE it's
   already on the board: dragging, resizing, rotating, or simply being
   touched (bringToFront). Only ever changes the fields present in
   `patch` -- e.g. a drag-end call only patches x/y, never touching
   width/height/rotation. Silently no-ops if the note isn't on the
   board (board_x is null) -- documented limitation, see the design
   spec's Error Handling / Data Model sections. */
export async function updatePrivateNoteBoardState(
  id: string,
  patch: { x?: number; y?: number; rotation?: number; width?: number; height?: number; bringToFront?: boolean }
) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (!note || note.boardX == null) return;
      if (patch.x !== undefined) note.boardX = patch.x;
      if (patch.y !== undefined) note.boardY = patch.y;
      if (patch.rotation !== undefined) note.boardRotation = patch.rotation;
      if (patch.width !== undefined) note.boardWidth = patch.width;
      if (patch.height !== undefined) note.boardHeight = patch.height;
      if (patch.bringToFront) {
        const maxZ = Math.max(0, ...(state.privateNotes || []).map((n) => n.boardZ || 0));
        note.boardZ = maxZ + 1;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with, board_x").eq("id", id).maybeSingle();
  if (!note || note.board_x == null || !canManageBoardState(note, me.name)) return;

  const update: Record<string, number | null> = {};
  if (patch.x !== undefined) update.board_x = patch.x;
  if (patch.y !== undefined) update.board_y = patch.y;
  if (patch.rotation !== undefined) update.board_rotation = patch.rotation;
  if (patch.width !== undefined) update.board_width = patch.width;
  if (patch.height !== undefined) update.board_height = patch.height;

  if (patch.bringToFront) {
    const { data: maxZRow } = await supabase
      .from("private_notes")
      .select("board_z")
      .not("board_z", "is", null)
      .order("board_z", { ascending: false })
      .limit(1)
      .maybeSingle();
    update.board_z = (maxZRow?.board_z || 0) + 1;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from("private_notes").update(update).eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Returns a note from the board to the ordinary list by clearing all
   six board columns -- this is the "drag it back" gesture. */
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
