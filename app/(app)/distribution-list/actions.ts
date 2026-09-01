"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
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

export async function addDistributionGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  state.distributionGroups = state.distributionGroups || [];
  state.distributionGroups.push({ id: crypto.randomUUID(), name, rows: [] });
  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}

export async function renameDistributionGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const group = (state.distributionGroups || []).find((g) => g.id === id);
  if (!group || !name) return;
  group.name = name;
  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}

export async function removeDistributionGroup(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  state.distributionGroups = (state.distributionGroups || []).filter((g) => g.id !== id);
  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}

function emptyBreakdown(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    out[c.key] = {};
    for (const l of DISTRIBUTION_LANGUAGES) out[c.key][l.key] = "";
  }
  return out;
}

export async function addDistributionRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("group") as string;
  const school = ((formData.get("school") as string) || "").trim();
  const group = (state.distributionGroups || []).find((g) => g.id === groupId);
  if (!group || !school) return;
  group.rows.push({ id: crypto.randomUUID(), school, breakdown: emptyBreakdown() });
  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}

export async function updateDistributionRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("groupId") as string;
  const rowId = formData.get("rowId") as string;
  const group = (state.distributionGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  const row = group.rows.find((r) => r.id === rowId);
  if (!row) return;

  row.enrolled = (formData.get("enrolled") as string) || "";
  row.contactPerson = (formData.get("contactPerson") as string) || "";
  row.remarks = (formData.get("remarks") as string) || "";
  row.breakdown = row.breakdown || emptyBreakdown();
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    row.breakdown[c.key] = row.breakdown[c.key] || {};
    for (const l of DISTRIBUTION_LANGUAGES) {
      const v = formData.get(`cell_${c.key}_${l.key}`);
      if (v !== null) row.breakdown[c.key][l.key] = v as string;
    }
  }

  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}

export async function removeDistributionRow(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const groupId = formData.get("groupId") as string;
  const rowId = formData.get("rowId") as string;
  const group = (state.distributionGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  group.rows = group.rows.filter((r) => r.id !== rowId);
  await saveState(supabase, state);
  revalidatePath("/distribution-list");
}
