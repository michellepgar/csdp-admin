"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, DISTRIBUTION_CLASSROOM_TYPES, DISTRIBUTION_LANGUAGES } from "@/lib/app-state";

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

/* Any signed-in team member can add a school (not admin-only),
   matching addContactGroup/addDistributionGroup elsewhere in this
   app. When a group is picked, also adds a blank row for this school
   to the same-named group on Contacts and Distribution List --
   creating that group there too if it doesn't already exist with
   that exact name -- so the school doesn't need adding a second and
   third time on those pages. Contact/distribution detail fields are
   deliberately left blank; filling them in is a normal edit on those
   pages, same as any other row. */
export async function addSchool(formData: FormData) {
  const { supabase } = await requireUserAndState();

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error: schoolError } = await supabase.from("schools").insert({ id: crypto.randomUUID(), name });
  if (schoolError) throw new Error(schoolError.message);

  const groupName = ((formData.get("groupName") as string) || "").trim();
  if (!groupName) {
    revalidatePath("/", "layout");
    return;
  }

  // Contacts: find-or-create the group, then add a blank row.
  // sort_order here mirrors addContactRow's own existing convention
  // in app/(app)/contacts/actions.ts -- a GLOBAL max across all
  // contact_rows, not scoped per group.
  let { data: contactGroup } = await supabase
    .from("contact_groups")
    .select("id")
    .eq("name", groupName)
    .maybeSingle();
  if (!contactGroup) {
    const { data: maxGroup } = await supabase
      .from("contact_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const newGroupId = crypto.randomUUID();
    const { error } = await supabase
      .from("contact_groups")
      .insert({ id: newGroupId, name: groupName, sort_order: (maxGroup?.sort_order ?? -1) + 1 });
    if (error) throw new Error(error.message);
    contactGroup = { id: newGroupId };
  }
  const { data: maxContactRow } = await supabase
    .from("contact_rows")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: contactRowError } = await supabase.from("contact_rows").insert({
    id: crypto.randomUUID(),
    group_id: contactGroup.id,
    school: name,
    sort_order: (maxContactRow?.sort_order ?? -1) + 1,
  });
  if (contactRowError) throw new Error(contactRowError.message);

  // Distribution List: find-or-create the group, then add a blank
  // row. sort_order here mirrors addDistributionRow's own existing
  // convention in app/(app)/distribution-list/actions.ts -- scoped to
  // the target group.
  let { data: distributionGroup } = await supabase
    .from("distribution_groups")
    .select("id")
    .eq("name", groupName)
    .maybeSingle();
  if (!distributionGroup) {
    const { data: maxGroup } = await supabase
      .from("distribution_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const newGroupId = crypto.randomUUID();
    const { error } = await supabase
      .from("distribution_groups")
      .insert({ id: newGroupId, name: groupName, sort_order: (maxGroup?.sort_order ?? -1) + 1 });
    if (error) throw new Error(error.message);
    distributionGroup = { id: newGroupId };
  }
  const { data: maxDistributionRow } = await supabase
    .from("distribution_rows")
    .select("sort_order")
    .eq("group_id", distributionGroup.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: distributionRowError } = await supabase.from("distribution_rows").insert({
    id: crypto.randomUUID(),
    group_id: distributionGroup.id,
    school: name,
    breakdown: emptyBreakdown(),
    sort_order: (maxDistributionRow?.sort_order ?? -1) + 1,
  });
  if (distributionRowError) throw new Error(distributionRowError.message);

  revalidatePath("/", "layout");
}
