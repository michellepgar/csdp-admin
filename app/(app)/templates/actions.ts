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

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function saveTemplate(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const category = ((formData.get("category") as string) || "").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const body = (formData.get("body") as string) || "";
  if (!name || !subject) return;

  if (id === "new") {
    const { data: maxRow } = await supabase
      .from("email_templates")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("email_templates").insert({
      id: crypto.randomUUID(),
      name,
      category: category || null,
      subject,
      body,
      sort_order: nextSortOrder,
    });
    orThrow(error);
  } else {
    const { error } = await supabase
      .from("email_templates")
      .update({ name, category: category || null, subject, body })
      .eq("id", id);
    orThrow(error);
  }
  revalidatePath("/templates");
}

export async function removeTemplate(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/templates");
}
