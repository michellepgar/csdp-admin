"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";

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

/* Any signed-in team member can add a school (not admin-only),
   matching addContactGroup/addDistributionGroup elsewhere in this
   app. Name-only for now -- a richer form (contact group, contact
   info, auto-adding to Contacts/Distribution List) is a deliberately
   deferred future idea, not built here. */
export async function addSchool(formData: FormData) {
  const { supabase } = await requireUserAndState();

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  const { error } = await supabase.from("schools").insert({ id: crypto.randomUUID(), name });
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
