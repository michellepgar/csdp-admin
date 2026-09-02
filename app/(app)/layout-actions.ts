"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, DISTRIBUTION_CLASSROOM_TYPES, DISTRIBUTION_LANGUAGES } from "@/lib/app-state";
import { syncContactRowEmail } from "@/lib/sync-contact-row";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

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

function emptyBreakdown(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const c of DISTRIBUTION_CLASSROOM_TYPES) {
    out[c.key] = {};
    for (const l of DISTRIBUTION_LANGUAGES) out[c.key][l.key] = "";
  }
  return out;
}

// Finds a group by exact name, or creates it with the next sort_order,
// and returns its id either way. Shared by the Contacts and
// Distribution List "find or create the group" steps in addSchool
// below, which were otherwise identical apart from the table name.
async function findOrCreateGroupByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "contact_groups" | "distribution_groups",
  name: string
): Promise<string> {
  const { data: existing } = await supabase.from(table).select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;

  const { data: maxRow } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const newId = crypto.randomUUID();
  orThrow(
    (
      await supabase.from(table).insert({ id: newId, name, sort_order: (maxRow?.sort_order ?? -1) + 1 })
    ).error
  );
  return newId;
}

/* Any signed-in team member can add a school (not admin-only),
   matching addContactGroup/addDistributionGroup elsewhere in this
   app. When a group is picked, also adds a blank row for this school
   to the same-named group on Contacts and Distribution List --
   creating that group there too if it doesn't already exist with
   that exact name -- so the school doesn't need adding a second and
   third time on those pages. Contact/distribution detail fields are
   deliberately left blank; filling them in is a normal edit on those
   pages, same as any other row.

   Known, accepted risks:
   - Neither contact_groups.name nor distribution_groups.name has a
     unique constraint, so two concurrent addSchool calls picking the
     same brand-new group name could both pass the "does it exist"
     check and insert a duplicate group. This is a small team doing
     infrequent school additions, so a DB constraint/transaction isn't
     warranted right now -- just noting the gap.
   - This function does 5 sequential writes with no transaction or
     rollback. If an early write succeeds and a later one fails (e.g.
     the school insert succeeds but a group or row insert doesn't),
     the school or a group can be left without its counterpart rows.
     Noted here so a future debugger knows where to look. */
export async function addSchool(formData: FormData) {
  const { supabase } = await requireUserAndState();

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const website = ((formData.get("website") as string) || "").trim();
  const hours = ((formData.get("hours") as string) || "").trim();

  const schoolId = crypto.randomUUID();
  orThrow(
    (
      await supabase.from("schools").insert({
        id: schoolId,
        name,
        website: website || null,
        hours: hours || null,
      })
    ).error
  );

  const groupName = ((formData.get("groupName") as string) || "").trim();
  if (groupName) {
    // Contacts: find-or-create the group, then add a blank row.
    // sort_order here mirrors addContactRow's own existing convention
    // in app/(app)/contacts/actions.ts -- a GLOBAL max across all
    // contact_rows, not scoped per group.
    const contactGroupId = await findOrCreateGroupByName(supabase, "contact_groups", groupName);
    const { data: maxContactRow } = await supabase
      .from("contact_rows")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    orThrow(
      (
        await supabase.from("contact_rows").insert({
          id: crypto.randomUUID(),
          group_id: contactGroupId,
          school: name,
          sort_order: (maxContactRow?.sort_order ?? -1) + 1,
        })
      ).error
    );

    // Distribution List: find-or-create the group, then add a blank
    // row. sort_order here mirrors addDistributionRow's own existing
    // convention in app/(app)/distribution-list/actions.ts -- scoped to
    // the target group.
    const distributionGroupId = await findOrCreateGroupByName(supabase, "distribution_groups", groupName);
    const { data: maxDistributionRow } = await supabase
      .from("distribution_rows")
      .select("sort_order")
      .eq("group_id", distributionGroupId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    orThrow(
      (
        await supabase.from("distribution_rows").insert({
          id: crypto.randomUUID(),
          group_id: distributionGroupId,
          school: name,
          breakdown: emptyBreakdown(),
          sort_order: (maxDistributionRow?.sort_order ?? -1) + 1,
        })
      ).error
    );
  }

  // Contact people: each becomes a school_contacts row; the affected
  // positions' matching contact_rows email columns are synced
  // afterward (a no-op for any position with no contact_rows entry to
  // write into -- see syncContactRowEmail's own doc comment).
  const contactsJson = (formData.get("contacts") as string) || "[]";
  let contacts: { position: string; email: string }[] = [];
  try {
    const parsed = JSON.parse(contactsJson);
    if (Array.isArray(parsed)) contacts = parsed;
  } catch {
    contacts = [];
  }

  const positionsUsed = new Set<string>();
  for (const c of contacts) {
    if (!c || typeof c.position !== "string" || typeof c.email !== "string") continue;
    const email = c.email.trim();
    if (!email) continue;
    orThrow(
      (
        await supabase.from("school_contacts").insert({
          id: crypto.randomUUID(),
          school_id: schoolId,
          position: c.position,
          email,
        })
      ).error
    );
    positionsUsed.add(c.position);
  }
  for (const position of positionsUsed) {
    await syncContactRowEmail(supabase, schoolId, name, position);
  }

  revalidatePath("/", "layout");
}
