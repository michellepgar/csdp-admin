"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  canDeletePrivateNote,
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

export async function addPrivateNote(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  const { error } = await supabase.from("private_notes").insert({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    shared_with: [],
    ack_by: [],
  });
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function sharePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || note.author !== me.name || !vaName) return;
  const sharedWith = note.sharedWith || [];
  if (sharedWith.includes(vaName)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ shared_with: [...sharedWith, vaName] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function unsharePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || note.author !== me.name) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ shared_with: (note.sharedWith || []).filter((n) => n !== vaName) })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function ackPrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note) return;
  const ackBy = note.ackBy || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ ack_by: [...ackBy, me.name] })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

export async function removePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || !canDeletePrivateNote(state, note, me.name)) return;

  const { error } = await supabase.from("private_notes").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}
