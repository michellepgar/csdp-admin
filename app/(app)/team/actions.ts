"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, type AppState } from "@/lib/app-state";

async function requireAdminAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) throw new Error("Not authorized");

  return { supabase, state };
}

// communicationEditor and schoolData assignments still live in the
// shared blob — they aren't migrating until later phases. vas is never
// written through this anymore (see the vas-table actions below).
async function saveLegacyState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: AppState
) {
  const { error } = await supabase
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function addVa(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  if (state.vas.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;

  const { error } = await supabase.from("vas").insert({ id: crypto.randomUUID(), name });
  if (error) {
    // 23505 = unique_violation. The in-memory check above catches the
    // common case; this is the backstop for two concurrent "Add VA"
    // submissions racing each other — not a real error from the
    // user's perspective, just "someone beat you to that name".
    if (error.code === "23505") return;
    throw new Error(error.message);
  }
  revalidatePath("/team");
}

export async function removeVa(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("vas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function updateVaField(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const id = formData.get("id") as string;
  const rawField = formData.get("field") as string;
  const value = ((formData.get("value") as string) || "").trim();
  if (rawField !== "email" && rawField !== "color") return;
  const field = rawField; // narrowed to "email" | "color" by the check above

  const { error } = await supabase.from("vas").update({ [field]: value }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function toggleVaAdmin(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const id = formData.get("id") as string;
  const va = state.vas.find((v) => v.id === id);
  if (!va) return;

  const { error } = await supabase.from("vas").update({ admin: !va.admin }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function setCommunicationEditor(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  state.communicationEditor = (formData.get("name") as string) || "";
  await saveLegacyState(supabase, state);
  revalidatePath("/team");
}

export async function setSchoolAssignment(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const schoolId = formData.get("schoolId") as string;
  const vaName = (formData.get("vaName") as string) || "";
  if (!state.schoolData[schoolId]) state.schoolData[schoolId] = { vaAssigned: "" };
  state.schoolData[schoolId].vaAssigned = vaName;
  await saveLegacyState(supabase, state);
  revalidatePath("/team");
}
