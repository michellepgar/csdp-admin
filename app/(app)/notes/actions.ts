"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAppState,
  findVaByEmail,
  isAdmin,
  canDeleteGeneralNote,
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

export async function addGeneralNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;
  const urgency = formData.get("urgent") ? "Urgent" : "";
  state.generalNotes = state.generalNotes || [];
  state.generalNotes.push({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    urgency,
    ackBy: [],
    createdAt: new Date().toISOString(),
  });
  await saveState(supabase, state);
  revalidatePath("/notes");
}

export async function ackGeneralNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.generalNotes || []).find((n) => n.id === id);
  if (!note) return;
  note.ackBy = note.ackBy || [];
  if (!note.ackBy.includes(me.name)) note.ackBy.push(me.name);
  await saveState(supabase, state);
  revalidatePath("/notes");
}

export async function removeGeneralNote(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const note = (state.generalNotes || []).find((n) => n.id === id);
  if (!note || !canDeleteGeneralNote(state, note, me.name, isAdmin(me))) return;
  state.generalNotes = (state.generalNotes || []).filter((n) => n.id !== id);
  await saveState(supabase, state);
  revalidatePath("/notes");
}
