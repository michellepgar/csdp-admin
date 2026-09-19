"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate, getDemoState } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* Cheap unread-count check for the bell's background poll
   (components/mentions-bell.tsx) -- one head-only count query instead of
   the whole-app fetch a page refresh costs, so the bell can notice a new
   notification within seconds without every open tab re-fetching
   everything. Returns -1 on any failure so the poll just skips that
   tick rather than showing a wrong number. */
export async function countMyUnreadNotifications(): Promise<number> {
  try {
    if (await isDemoMode()) {
      const state = await getDemoState();
      return (state.mentions || []).filter((m) => m.mentionedName === "Jane" && !m.readAt).length;
    }
    const { supabase, me } = await requireTeamMember();
    const { count, error } = await supabase
      .from("mentions")
      .select("id", { count: "exact", head: true })
      .eq("mentioned_name", me.name)
      .is("read_at", null);
    return error ? -1 : count ?? 0;
  } catch {
    return -1;
  }
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
  revalidatePath("/overview");
}
