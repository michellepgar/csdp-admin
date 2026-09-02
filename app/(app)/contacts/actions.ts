"use server";

import { revalidatePath } from "next/cache";
import { CONTACT_FIELDS, type ContactRow } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// CONTACT_FIELDS' keys are the camelCase ContactRow field names; this
// maps each one to its snake_case column name in contact_rows.
const CONTACT_FIELD_TO_COLUMN: Record<keyof ContactRow, string> = {
  id: "id",
  school: "school",
  principal: "principal",
  principalEmail: "principal_email",
  asstPrincipal: "asst_principal",
  asstPrincipalEmail: "asst_principal_email",
  frontDesk: "front_desk",
  frontDeskEmail: "front_desk_email",
  nurseName: "nurse_name",
  nurseEmail: "nurse_email",
  notes: "notes",
};

export async function addContactGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { data: maxRow } = await supabase
    .from("contact_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("contact_groups")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/contacts");
}

export async function renameContactGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error } = await supabase.from("contact_groups").update({ name }).eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function removeContactGroup(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("contact_groups").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function updateContactRow(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const rowId = formData.get("rowId") as string;
  const moveToGroupId = formData.get("moveToGroupId") as string;

  const updates: Record<string, string> = {};
  for (const f of CONTACT_FIELDS) {
    const v = formData.get(f.key);
    if (v !== null) updates[CONTACT_FIELD_TO_COLUMN[f.key]] = v as string;
  }
  /* A real group_id foreign key makes "move to a different group" a
     one-column update — the blob version had to splice the row out of
     one group's array and push it into another's. */
  if (moveToGroupId) updates.group_id = moveToGroupId;

  const { error } = await supabase.from("contact_rows").update(updates).eq("id", rowId);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function removeContactRow(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const rowId = formData.get("rowId") as string;

  const { error } = await supabase.from("contact_rows").delete().eq("id", rowId);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function setNurseLeader(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();

  const { error } = await supabase
    .from("settings")
    .upsert({ key: "nurseLeader", value: { name, email } }, { onConflict: "key" });
  orThrow(error);
  revalidatePath("/contacts");
}

/* ---------- Other Contacts (not tied to any school) ---------- */

export async function addOtherContact(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  const organization = ((formData.get("organization") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  const { error } = await supabase.from("other_contacts").insert({
    id: crypto.randomUUID(),
    name,
    organization: organization || null,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  });
  orThrow(error);
  revalidatePath("/contacts");
}

export async function updateOtherContact(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  const organization = ((formData.get("organization") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  const { error } = await supabase
    .from("other_contacts")
    .update({
      name,
      organization: organization || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function removeOtherContact(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("other_contacts").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}
