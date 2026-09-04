"use server";

import { revalidatePath } from "next/cache";
import {
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
  type LegacyDistributionCell,
  type DistributionGroup,
  type DistributionRow,
} from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

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

// Number of Consent Packets is derived, not entered -- see
// distributionRowConsentPacketsTotal's comment in lib/app-state.ts for
// why this is Packets + Extra Packets only (not Loose/Extra Loose, not
// multiplied by packet size).
function consentPacketsFromBreakdown(breakdown: Record<string, Record<string, LegacyDistributionCell>>): number {
  let total = 0;
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    for (const l of DISTRIBUTION_LANGUAGES) {
      const cell = breakdown[c.key]?.[l.key];
      total += (Number(cell?.packets) || 0) + (Number(cell?.extraPackets) || 0);
    }
  }
  return total;
}

export async function addDistributionGroup(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.distributionGroups ??= []).push({ id: `demo-${Date.now()}`, name, rows: [] });
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

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
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const group = (state.distributionGroups || []).find((g) => g.id === id);
      if (group) group.name = name;
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("distribution_groups").update({ name }).eq("id", id);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function removeDistributionGroup(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.distributionGroups = (state.distributionGroups || []).filter((g) => g.id !== id);
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("distribution_groups").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function addDistributionRow(formData: FormData) {
  const groupId = formData.get("group") as string;
  const school = ((formData.get("school") as string) || "").trim();
  if (!groupId || !school) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const group = (state.distributionGroups || []).find((g) => g.id === groupId);
      if (group) group.rows.push({ id: `demo-${Date.now()}`, school, breakdown: emptyBreakdown() });
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

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
  const rowId = formData.get("rowId") as string;
  const moveToGroupId = formData.get("moveToGroupId") as string;
  const breakdown = breakdownFromForm(formData);

  if (await isDemoMode()) {
    await demoMutate((state) => {
      let row: DistributionRow | undefined;
      let fromGroup: DistributionGroup | undefined;
      for (const g of state.distributionGroups || []) {
        const found = g.rows.find((r) => r.id === rowId);
        if (found) {
          row = found;
          fromGroup = g;
          break;
        }
      }
      if (!row) return;
      row.enrolled = (formData.get("enrolled") as string) || "";
      row.classroomRegular = (formData.get("classroomRegular") as string) || "";
      row.classroomLaunch = (formData.get("classroomLaunch") as string) || "";
      row.classroomCrr = (formData.get("classroomCrr") as string) || "";
      row.consentPackets = String(consentPacketsFromBreakdown(breakdown));
      row.contactPerson = (formData.get("contactPerson") as string) || "";
      row.remarks = (formData.get("remarks") as string) || "";
      row.breakdown = breakdown;
      if (moveToGroupId && fromGroup && moveToGroupId !== fromGroup.id) {
        const toGroup = (state.distributionGroups || []).find((g) => g.id === moveToGroupId);
        if (toGroup) {
          fromGroup.rows = fromGroup.rows.filter((r) => r.id !== rowId);
          toGroup.rows.push(row);
        }
      }
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

  const updates: Record<string, unknown> = {
    enrolled: (formData.get("enrolled") as string) || "",
    classroom_regular: (formData.get("classroomRegular") as string) || "",
    classroom_launch: (formData.get("classroomLaunch") as string) || "",
    classroom_crr: (formData.get("classroomCrr") as string) || "",
    consent_packets: String(consentPacketsFromBreakdown(breakdown)),
    contact_person: (formData.get("contactPerson") as string) || "",
    remarks: (formData.get("remarks") as string) || "",
    breakdown,
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
  const rowId = formData.get("rowId") as string;
  const distributed = formData.get("distributed") === "true";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const g of state.distributionGroups || []) {
        const row = g.rows.find((r) => r.id === rowId);
        if (row) row.distributed = distributed;
      }
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("distribution_rows").update({ distributed }).eq("id", rowId);
  orThrow(error);
  revalidatePath("/distribution-list");
}

export async function removeDistributionRow(formData: FormData) {
  const rowId = formData.get("rowId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const g of state.distributionGroups || []) g.rows = g.rows.filter((r) => r.id !== rowId);
    });
    revalidatePath("/distribution-list");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("distribution_rows").delete().eq("id", rowId);
  orThrow(error);
  revalidatePath("/distribution-list");
}
