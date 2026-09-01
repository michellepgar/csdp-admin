"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, CONTACT_FIELDS, type AppState, type ContactRow } from "@/lib/app-state";

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

export async function addContactGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  state.contactGroups = state.contactGroups || [];
  state.contactGroups.push({ id: crypto.randomUUID(), name, rows: [] });
  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function renameContactGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const group = (state.contactGroups || []).find((g) => g.id === id);
  if (!group || !name) return;
  group.name = name;
  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function removeContactGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  state.contactGroups = (state.contactGroups || []).filter((g) => g.id !== id);
  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function addContactRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("group") as string;
  const school = ((formData.get("school") as string) || "").trim();
  const group = (state.contactGroups || []).find((g) => g.id === groupId);
  if (!group || !school) return;
  group.rows.push({ id: crypto.randomUUID(), school });
  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function updateContactRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("groupId") as string;
  const rowId = formData.get("rowId") as string;
  const moveToGroupId = formData.get("moveToGroupId") as string;
  const group = (state.contactGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  const row = group.rows.find((r) => r.id === rowId);
  if (!row) return;

  for (const f of CONTACT_FIELDS) {
    const v = formData.get(f.key);
    if (v !== null) row[f.key] = v as string;
  }

  if (moveToGroupId && moveToGroupId !== groupId) {
    const target = (state.contactGroups || []).find((g) => g.id === moveToGroupId);
    if (target) {
      group.rows = group.rows.filter((r) => r.id !== rowId);
      target.rows.push(row as ContactRow);
    }
  }

  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function removeContactRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("groupId") as string;
  const rowId = formData.get("rowId") as string;
  const group = (state.contactGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  group.rows = group.rows.filter((r) => r.id !== rowId);
  await saveState(supabase, state);
  revalidatePath("/contacts");
}

export async function setNurseLeader(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  state.nurseLeader = { name, email };
  await saveState(supabase, state);
  revalidatePath("/contacts");
}
