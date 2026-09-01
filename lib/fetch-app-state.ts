import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppState } from "@/lib/app-state";

/* Kept in its own file, separate from lib/app-state.ts's types/constants
   — this imports @/lib/supabase/server (next/headers), which is
   server-only. lib/app-state.ts is imported by client components too
   (for shared types/constants like CONTACT_FIELDS); if this function
   lived there, that server-only import would get dragged into the
   client bundle, which Next.js's build correctly refuses to do.

   Wrapped in React's cache() so the layout and the page it's rendering
   (both of which need the same data) share one actual network call per
   request instead of two. Only dedupes within a single request/render
   pass, not across a Server Action call and the page re-render that
   follows it — those are genuinely separate requests. */
export const fetchAppState = cache(async (): Promise<AppState | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", 1)
    .single();

  if (error || !data) return null;
  return data.data as AppState;
});
