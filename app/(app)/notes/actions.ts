"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  isAdmin,
  canDeleteGeneralNote,
} from "@/lib/app-state";

async function requireUserAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me) throw new Error("Not on the team list");

  return { supabase, state, me };
}

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addGeneralNote(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;
  const urgency = formData.get("urgent") ? "Urgent" : "";

  const { error } = await supabase.from("general_notes").insert({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    urgency: urgency || null,
    ack_by: [],
  });
  orThrow(error);
  revalidatePath("/notes");
}

export async function ackGeneralNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.generalNotes || []).find((n) => n.id === id);
  if (!note) return;
  const ackBy = note.ackBy || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase
    .from("general_notes")
    .update({ ack_by: [...ackBy, me.name] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/notes");
}

export async function removeGeneralNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.generalNotes || []).find((n) => n.id === id);
  if (!note || !canDeleteGeneralNote(state, note, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("general_notes").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/notes");
}
