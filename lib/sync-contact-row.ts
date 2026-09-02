import type { createClient } from "@/lib/supabase/server";

const POSITION_TO_EMAIL_COLUMN: Record<string, string> = {
  Principal: "principal_email",
  "Assistant Principal": "asst_principal_email",
  "Front Desk": "front_desk_email",
  Nurse: "nurse_email",
};

/* Keeps the old Contacts table's email field for one position in sync
   with the newest school_contacts entry for that (school, position)
   pair -- see docs/superpowers/specs/2026-09-03-school-onboarding-v2-design.md.
   Call this after ANY add/edit/delete of a school_contacts row, with
   the position that was affected.

   Matches contact_rows by school NAME (a free-text field, not a
   foreign key -- the same convention contact_rows/distribution_rows
   already use throughout this app), unrelated to school_contacts's
   own real foreign key on school_id.

   Silently no-ops if there's no contact_rows entry for this school at
   all (happens when the school was added with no group picked, since
   a contact_rows row can't exist without a group_id) -- a documented,
   accepted limitation, not a bug to work around. */
export async function syncContactRowEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  schoolName: string,
  position: string
) {
  const column = POSITION_TO_EMAIL_COLUMN[position];
  if (!column) return;

  const { data: newest } = await supabase
    .from("school_contacts")
    .select("email")
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
    .update({ [column]: newest?.email ?? null })
    .eq("id", contactRow.id);
}
