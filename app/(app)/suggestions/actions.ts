"use server";

import { revalidatePath } from "next/cache";
import { SUPERADMIN_NAME, canDeleteSuggestion } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addSuggestion(formData: FormData) {
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.suggestions ??= []).push({ id: `demo-${Date.now()}`, text, author: "Jane", status: "Requested", createdAt: new Date().toISOString() });
    });
    revalidatePath("/suggestions");
    return;
  }

  const { supabase, me } = await requireTeamMember();

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
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (status !== "Requested" && status !== "Working On It" && status !== "Added") return;

  // The demo's "Jane" isn't the real SUPERADMIN_NAME this is normally
  // gated to -- letting the demo account try every status here (not
  // just add/remove) is the whole point, so this one check is skipped
  // in demo mode rather than made to always fail for her.
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const suggestion = (state.suggestions || []).find((s) => s.id === id);
      if (suggestion) suggestion.status = status;
    });
    revalidatePath("/suggestions");
    return;
  }

  const { supabase, me } = await requireTeamMember();
  if (me.name !== SUPERADMIN_NAME) throw new Error("Not authorized");

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}

/* Same rule as canDeleteSuggestion in lib/app-state.ts: only the person
   who posted it, or Michelle. */
export async function removeSuggestion(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.suggestions = (state.suggestions || []).filter((s) => !(s.id === id && canDeleteSuggestion(s, "Jane")));
    });
    revalidatePath("/suggestions");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: suggestion } = await supabase.from("suggestions").select("author").eq("id", id).maybeSingle();
  if (!suggestion) return;

  if (!canDeleteSuggestion({ id, text: "", author: suggestion.author, createdAt: "", status: "Requested" }, me.name)) return;

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}
