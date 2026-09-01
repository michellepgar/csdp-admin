"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, type AppState } from "@/lib/app-state";

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

  return { supabase, state };
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

export async function saveTemplate(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const category = ((formData.get("category") as string) || "").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const body = (formData.get("body") as string) || "";
  if (!name || !subject) return;

  state.emailTemplates = state.emailTemplates || [];
  if (id === "new") {
    state.emailTemplates.push({ id: crypto.randomUUID(), name, category, subject, body });
  } else {
    const tmpl = state.emailTemplates.find((t) => t.id === id);
    if (!tmpl) return;
    tmpl.name = name;
    tmpl.category = category;
    tmpl.subject = subject;
    tmpl.body = body;
  }
  await saveState(supabase, state);
  revalidatePath("/templates");
}

export async function removeTemplate(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  state.emailTemplates = (state.emailTemplates || []).filter((t) => t.id !== id);
  await saveState(supabase, state);
  revalidatePath("/templates");
}
