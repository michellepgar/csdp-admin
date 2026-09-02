"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  canDeleteSuggestion,
  SUPERADMIN_NAME,
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

export async function addSuggestion(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  const { error } = await supabase.from("suggestions").insert({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    status: "Requested",
  });
  orThrow(error);
  revalidatePath("/suggestions");
}

export async function setSuggestionStatus(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  if (me.name !== SUPERADMIN_NAME) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (status !== "Requested" && status !== "Working On It" && status !== "Added") return;

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}

export async function removeSuggestion(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const suggestion = (state.suggestions || []).find((s) => s.id === id);
  if (!suggestion || !canDeleteSuggestion(state, suggestion, me.name)) return;

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}
