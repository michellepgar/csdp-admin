"use server";

import { revalidatePath } from "next/cache";
import {
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
  type LegacyDistributionCell,
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

// Full packets/packetSize/loose/extraPackets/extraLoose breakdown per
// classroom-type x language cell, read from RowEdit's grid of inputs
// (named e.g. "packets_regular_engSpn").
function breakdownFromForm(formData: FormData): Record<string, Record<string, LegacyDistributionCell>> {
  const breakdown: Record<string, Record<string, LegacyDistributionCell>> = {};
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    breakdown[c.key] = {};
    for (const l of DISTRIBUTION_LANGUAGES) {
      breakdown[c.key][l.key] = {
        packets: (formData.get(`packets_${c.key}_${l.key}`) as string) || "",
        packetSize: (formData.get(`packetSize_${c.key}_${l.key}`) as string) || "25",
        loose: (formData.get(`loose_${c.key}_${l.key}`) as string) || "",
        extraPackets: (formData.get(`extraPackets_${c.key}_${l.key}`) as string) || "",
        extraLoose: (formData.get(`extraLoose_${c.key}_${l.key}`) as string) || "",
      };
    }
  }
  return breakdown;
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
  const moveToGroupId = formData.get("moveToGroupId") as string;

  const updates: Record<string, unknown> = {
    enrolled: (formData.get("enrolled") as string) || "",
    classroom_regular: (formData.get("classroomRegular") as string) || "",
    classroom_launch: (formData.get("classroomLaunch") as string) || "",
    classroom_crr: (formData.get("classroomCrr") as string) || "",
    consent_packets: (formData.get("consentPackets") as string) || "",
    contact_person: (formData.get("contactPerson") as string) || "",
    remarks: (formData.get("remarks") as string) || "",
    breakdown: breakdownFromForm(formData),
  };
  // Same "real FK, one-column update" reasoning as Contacts' own move-
  // to-group (app/(app)/contacts/actions.ts's updateContactRow).
  if (moveToGroupId) updates.group_id = moveToGroupId;

  const { error } = await supabase.from("distribution_rows").update(updates).eq("id", rowId);
  orThrow(error);
  revalidatePath("/distribution-list");
}

// Instant toggle from the compact row's checkbox -- doesn't touch any
// other field, unlike updateDistributionRow above which expects the
// whole breakdown grid every time.
export async function toggleDistributionRowDistributed(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const rowId = formData.get("rowId") as string;
  const distributed = formData.get("distributed") === "true";

  const { error } = await supabase.from("distribution_rows").update({ distributed }).eq("id", rowId);
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
