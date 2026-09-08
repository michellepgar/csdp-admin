import type { createClient } from "@/lib/supabase/server";

const POSITION_TO_COLUMNS: Record<string, { name: string; email: string }> = {
  Principal: { name: "principal", email: "principal_email" },
  "Assistant Principal": { name: "asst_principal", email: "asst_principal_email" },
  "Front Desk": { name: "front_desk", email: "front_desk_email" },
  Nurse: { name: "nurse_name", email: "nurse_email" },
};

/* Keeps the old Contacts table's name+email fields for one position in
   sync with the newest school_contacts entry for that (school,
   position) pair -- see docs/superpowers/specs/2026-09-03-school-onboarding-v2-design.md.
   Call this after ANY add/edit/delete of a school_contacts row, with
   the position that was affected.

   Matches contact_rows by school NAME (a free-text field, not a
   foreign key -- the same convention contact_rows/distribution_rows
   already use throughout this app), unrelated to school_contacts's
   own real foreign key on school_id.

   Silently no-ops if there's no contact_rows entry for this school at
   all (happens when the school was added with no group picked, since
   a contact_rows row can't exist without a group_id) -- a documented,
   accepted limitation, not a bug to work around.

   Originally email-only; extended to also sync name once
   school_contacts grew a name column (added so a second contact for
   the same position -- e.g. a school with two nurses -- can be told
   apart in its own list, see components/school-contacts-list.tsx).
   The single Contacts-page field for a position still only ever shows
   ONE name+email pair -- whichever school_contacts entry for that
   position was added or edited most recently. */
export async function syncContactRowEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  schoolName: string,
  position: string
) {
  const columns = POSITION_TO_COLUMNS[position];
  if (!columns) return;

  const { data: newest } = await supabase
    .from("school_contacts")
    .select("name, email")
    .eq("school_id", schoolId)
    .eq("position", position)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: contactRow } = await supabase
    .from("contact_rows")
    .select("id")
    .eq("school", schoolName)
    .maybeSingle();
  if (!contactRow) return;

  await supabase
    .from("contact_rows")
    .update({ [columns.name]: newest?.name ?? null, [columns.email]: newest?.email ?? null })
    .eq("id", contactRow.id);
}
