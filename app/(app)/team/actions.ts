"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState, findVaByEmail, isAdmin, type AppState } from "@/lib/app-state";

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

export async function addVa(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  if (state.vas.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
  state.vas.push({ id: crypto.randomUUID(), name });
  await saveState(supabase, state);
  revalidatePath("/team");
}

export async function removeVa(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const id = formData.get("id") as string;
  state.vas = state.vas.filter((v) => v.id !== id);
  await saveState(supabase, state);
  revalidatePath("/team");
}

export async function updateVaField(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const id = formData.get("id") as string;
  const rawField = formData.get("field") as string;
  const value = ((formData.get("value") as string) || "").trim();
  if (rawField !== "email" && rawField !== "color") return;
  const field = rawField; // narrowed to "email" | "color" by the check above
  const va = state.vas.find((v) => v.id === id);
  if (!va) return;
  va[field] = value;
  await saveState(supabase, state);
  revalidatePath("/team");
}

export async function toggleVaAdmin(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const id = formData.get("id") as string;
  const va = state.vas.find((v) => v.id === id);
  if (!va) return;
  va.admin = !va.admin;
  await saveState(supabase, state);
  revalidatePath("/team");
}

export async function setCommunicationEditor(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  state.communicationEditor = (formData.get("name") as string) || "";
  await saveState(supabase, state);
  revalidatePath("/team");
}

export async function setSchoolAssignment(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const schoolId = formData.get("schoolId") as string;
  const vaName = (formData.get("vaName") as string) || "";
  if (!state.schoolData[schoolId]) state.schoolData[schoolId] = { vaAssigned: "" };
  state.schoolData[schoolId].vaAssigned = vaName;
  await saveState(supabase, state);
  revalidatePath("/team");
}
