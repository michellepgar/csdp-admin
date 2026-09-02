"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, CONTACT_FIELDS, type ContactRow } from "@/lib/app-state";

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

  return { supabase };
}

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
  const { supabase } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error } = await supabase.from("contact_groups").insert({ id: crypto.randomUUID(), name });
  orThrow(error);
  revalidatePath("/contacts");
}

export async function renameContactGroup(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error } = await supabase.from("contact_groups").update({ name }).eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function removeContactGroup(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("contact_groups").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function addContactRow(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const groupId = formData.get("group") as string;
  const school = ((formData.get("school") as string) || "").trim();
  if (!groupId || !school) return;

  const { error } = await supabase.from("contact_rows").insert({
    id: crypto.randomUUID(),
    group_id: groupId,
    school,
  });
  orThrow(error);
  revalidatePath("/contacts");
}

export async function updateContactRow(formData: FormData) {
  const { supabase } = await requireUserAndState();
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
  const { supabase } = await requireUserAndState();
  const rowId = formData.get("rowId") as string;

  const { error } = await supabase.from("contact_rows").delete().eq("id", rowId);
  orThrow(error);
  revalidatePath("/contacts");
}

export async function setNurseLeader(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();

  const { error } = await supabase
    .from("settings")
    .upsert({ key: "nurseLeader", value: { name, email } }, { onConflict: "key" });
  orThrow(error);
  revalidatePath("/contacts");
}
