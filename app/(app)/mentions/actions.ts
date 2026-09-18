"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function markMentionRead(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const mention = (state.mentions || []).find((m) => m.id === id);
      if (mention) mention.readAt = new Date().toISOString();
    });
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: mention } = await supabase.from("mentions").select("mentioned_name").eq("id", id).maybeSingle();
  if (!mention || mention.mentioned_name !== me.name) return;

  const { error } = await supabase.from("mentions").update({ read_at: new Date().toISOString() }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
  revalidatePath("/notes");
}
