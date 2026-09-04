"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addGeneralNote(formData: FormData) {
  const rawText = ((formData.get("text") as string) || "").trim();
  if (!rawText) return;
  const text = sanitizeNoteHtml(rawText);
  const padColor = (formData.get("padColor") as string) || undefined;
  const urgency = formData.get("urgent") ? "Urgent" : "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.generalNotes ??= []).push({ id: `demo-${Date.now()}`, text, padColor, author: "Jane", urgency: (urgency || "") as "Urgent" | "", ackBy: [], createdAt: new Date().toISOString() });
    });
    revalidatePath("/notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { error } = await supabase.from("general_notes").insert({
    id: crypto.randomUUID(),
    text,
    pad_color: padColor || null,
    author: me.name,
    urgency: urgency || null,
    ack_by: [],
  });
  orThrow(error);
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
