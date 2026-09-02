"use server";

import { revalidatePath } from "next/cache";
import { SUPERADMIN_NAME } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addSuggestion(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  const { error } = await supabase.from("suggestions").insert({
    id: crypto.randomUUID(),
    text,
    author: me.name,
    status: "Requested",
  });
  orThrow(error);
  revalidatePath("/suggestions");
}

export async function setSuggestionStatus(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  if (me.name !== SUPERADMIN_NAME) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (status !== "Requested" && status !== "Working On It" && status !== "Added") return;

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}

/* Same rule as canDeleteSuggestion in lib/app-state.ts (the author can
   always delete their own; once they're no longer on the team, anyone
   can clean it up), reimplemented as two targeted queries instead of
   fetchAppState()'s full ~19-table fetch. */
export async function removeSuggestion(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { data: suggestion } = await supabase.from("suggestions").select("author").eq("id", id).maybeSingle();
  if (!suggestion) return;

  let canDelete = suggestion.author === me.name;
  if (!canDelete) {
    const { data: authorVa } = await supabase.from("vas").select("id").eq("name", suggestion.author).maybeSingle();
    canDelete = !authorVa;
  }
  if (!canDelete) return;

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}
