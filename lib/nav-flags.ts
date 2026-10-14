import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDemoState } from "@/lib/demo-session";

export type NavFlags = { privateNote: boolean; generalNote: boolean; issueComment: boolean };

type FlagRows = {
  privateNotes: { author: string; sharedWith: string[]; ackBy: string[] }[];
  urgentNotes: { author: string; ackBy: string[] }[];
  issues: { hasComments: boolean; commentAckBy: string[] }[];
};

/* The blinking dots on the sidebar (a private note shared with you that you
   haven't opened, an urgent general note, new comments on an issue). These
   used to come from loading every note and issue in full on every page; this
   asks only for the few columns the dots need. It doesn't need to know who you
   are, so the layout starts it at the same time as everything else. */
export const loadNavFlagRows = cache(async (): Promise<FlagRows> => {
  if ((await cookies()).get("demo-mode")?.value === "1") {
    const state = await getDemoState();
    return {
      privateNotes: (state.privateNotes || []).map((n) => ({ author: n.author, sharedWith: n.sharedWith || [], ackBy: n.ackBy || [] })),
      urgentNotes: (state.generalNotes || []).filter((n) => n.urgency === "Urgent").map((n) => ({ author: n.author, ackBy: n.ackBy || [] })),
      issues: (state.issues || []).map((i) => ({ hasComments: (i.comments || []).length > 0, commentAckBy: i.commentAckBy || [] })),
    };
  }

  const supabase = await createClient();
  const [privateNotes, urgentNotes, issues, commented] = await Promise.all([
    supabase.from("private_notes").select("author, shared_with, ack_by"),
    supabase.from("general_notes").select("author, ack_by").eq("urgency", "Urgent"),
    supabase.from("issues").select("id, comment_ack_by"),
    supabase.from("issue_comments").select("issue_id"),
  ]);
  const withComments = new Set((commented.data || []).map((c) => c.issue_id as string));
  return {
    privateNotes: (privateNotes.data || []).map((n) => ({ author: n.author as string, sharedWith: (n.shared_with as string[] | null) || [], ackBy: (n.ack_by as string[] | null) || [] })),
    urgentNotes: (urgentNotes.data || []).map((n) => ({ author: n.author as string, ackBy: (n.ack_by as string[] | null) || [] })),
    issues: (issues.data || []).map((i) => ({ hasComments: withComments.has(i.id as string), commentAckBy: (i.comment_ack_by as string[] | null) || [] })),
  };
});

/* The same rules the layout used before, applied to the small rows above. */
export function navFlagsFor(rows: FlagRows, myName: string): NavFlags {
  return {
    privateNote: rows.privateNotes.some((n) => n.sharedWith.includes(myName) && !n.ackBy.includes(myName)),
    generalNote: rows.urgentNotes.some((n) => n.author !== myName && !n.ackBy.includes(myName)),
    issueComment: rows.issues.some((i) => i.hasComments && !i.commentAckBy.includes(myName)),
  };
}
