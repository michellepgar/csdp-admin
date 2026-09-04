"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function saveTemplate(formData: FormData) {
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  const category = ((formData.get("category") as string) || "").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const body = (formData.get("body") as string) || "";
  if (!name || !subject) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      if (id === "new") {
        (state.emailTemplates ??= []).push({ id: `demo-${Date.now()}`, name, category: category || undefined, subject, body });
      } else {
        const template = (state.emailTemplates || []).find((t) => t.id === id);
        if (template) {
          template.name = name;
          template.category = category || undefined;
          template.subject = subject;
          template.body = body;
        }
      }
    });
    revalidatePath("/templates");
    return;
  }

  const { supabase } = await requireTeamMember();

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
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.emailTemplates = (state.emailTemplates || []).filter((t) => t.id !== id);
    });
    revalidatePath("/templates");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/templates");
}
