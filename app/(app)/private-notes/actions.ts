"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  canDeletePrivateNote,
  type AppState,
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

async function saveState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: AppState
) {
  const { error } = await supabase
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function addPrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;
  state.privateNotes = state.privateNotes || [];
  state.privateNotes.push({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    sharedWith: [],
    ackBy: [],
    createdAt: new Date().toISOString(),
  });
  await saveState(supabase, state);
  revalidatePath("/private-notes");
}

export async function sharePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || note.author !== me.name || !vaName) return;
  note.sharedWith = note.sharedWith || [];
  if (!note.sharedWith.includes(vaName)) note.sharedWith.push(vaName);
  await saveState(supabase, state);
  revalidatePath("/private-notes");
}

export async function unsharePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const vaName = formData.get("vaName") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || note.author !== me.name) return;
  note.sharedWith = (note.sharedWith || []).filter((n) => n !== vaName);
  await saveState(supabase, state);
  revalidatePath("/private-notes");
}

export async function ackPrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note) return;
  note.ackBy = note.ackBy || [];
  if (!note.ackBy.includes(me.name)) note.ackBy.push(me.name);
  await saveState(supabase, state);
  revalidatePath("/private-notes");
}

export async function removePrivateNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.privateNotes || []).find((n) => n.id === id);
  if (!note || !canDeletePrivateNote(state, note, me.name)) return;
  state.privateNotes = (state.privateNotes || []).filter((n) => n.id !== id);
  await saveState(supabase, state);
  revalidatePath("/private-notes");
}
