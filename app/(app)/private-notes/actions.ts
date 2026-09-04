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
