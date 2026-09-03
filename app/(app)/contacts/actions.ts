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

/* No manual "add group" action here anymore -- a group is created
   automatically the moment a school is added with that group picked
   (see createSchool/findOrCreateGroupByName in
   app/(app)/layout-actions.ts), so a separate manual path was
   removed as redundant per Michelle's request. renameContactGroup/
   removeContactGroup below still apply to whatever groups exist. */

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

  /* Website/phone/fax/hours live on `schools`, not `contact_rows` --
     editable from here too (this row's edit form is where Michelle
     asked for them), but only actually shown on the school's own
     page, never as a column in this page's table. schoolId is only
     present when components/contacts-list.tsx found a school whose
     name matches this row's `school` text (same name-matching this
     app already relies on elsewhere, e.g. the school page finding its
     own contact_rows entry) -- a row with no match just doesn't
     submit it, and nothing here is touched. */
  const schoolId = formData.get("schoolId") as string | null;
  if (schoolId) {
    const website = ((formData.get("website") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const fax = ((formData.get("fax") as string) || "").trim();
    const hours = ((formData.get("hours") as string) || "").trim();
    const { error: schoolError } = await supabase
      .from("schools")
      .update({ website: website || null, phone: phone || null, fax: fax || null, hours: hours || null })
      .eq("id", schoolId);
    orThrow(schoolError);
    revalidatePath(`/schools/${schoolId}`);
  }

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
