"use server";

import { revalidatePath } from "next/cache";
import {
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
} from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function emptyBreakdown(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    out[c.key] = {};
    for (const l of DISTRIBUTION_LANGUAGES) out[c.key][l.key] = "";
  }
  return out;
}

export async function addDistributionGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { data: maxRow } = await supabase
    .from("distribution_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("distribution_groups")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function renameDistributionGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error } = await supabase.from("distribution_groups").update({ name }).eq("id", id);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function removeDistributionGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("distribution_groups").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function addDistributionRow(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const groupId = formData.get("group") as string;
  const school = ((formData.get("school") as string) || "").trim();
  if (!groupId || !school) return;

  const { data: maxRow } = await supabase
    .from("distribution_rows")
    .select("sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("distribution_rows").insert({
    id: crypto.randomUUID(),
    group_id: groupId,
    school,
    breakdown: emptyBreakdown(),
    sort_order: nextSortOrder,
  });
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function updateDistributionRow(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const rowId = formData.get("rowId") as string;

  const breakdown: Record<string, Record<string, string>> = emptyBreakdown();
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    for (const l of DISTRIBUTION_LANGUAGES) {
      const v = formData.get(`cell_${c.key}_${l.key}`);
      if (v !== null) breakdown[c.key][l.key] = v as string;
    }
  }

  const { error } = await supabase
    .from("distribution_rows")
    .update({
      enrolled: (formData.get("enrolled") as string) || "",
      contact_person: (formData.get("contactPerson") as string) || "",
      remarks: (formData.get("remarks") as string) || "",
      breakdown,
    })
    .eq("id", rowId);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function removeDistributionRow(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const rowId = formData.get("rowId") as string;

  const { error } = await supabase.from("distribution_rows").delete().eq("id", rowId);
  orThrow(error);
  revalidatePath("/distribution-list");
}
