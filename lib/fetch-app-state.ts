import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppState, Va, School } from "@/lib/app-state";

type VaRow = {
  id: string;
  name: string;
  email: string | null;
  admin: boolean | null;
  role: string | null;
  color: string | null;
};

function mapVaRow(r: VaRow): Va {
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    admin: r.admin ?? undefined,
    role: r.role ?? undefined,
    color: r.color ?? undefined,
  };
}

/* Kept in its own file, separate from lib/app-state.ts's types/constants
   — this imports @/lib/supabase/server (next/headers), which is
   server-only. lib/app-state.ts is imported by client components too
   (for shared types/constants like CONTACT_FIELDS); if this function
   lived there, that server-only import would get dragged into the
   client bundle, which Next.js's build correctly refuses to do.

   Wrapped in React's cache() so the layout and the page it's rendering
   (both of which need the same data) share one actual set of network
   calls per request instead of two. Only dedupes within a single
   request/render pass, not across a Server Action call and the page
   re-render that follows it — those are genuinely separate requests.

   vas and schools are read from their own tables (Phase 1 of the
   relational backend migration — see
   docs/superpowers/specs/2026-09-02-relational-backend-design.md).
   Everything else still comes from the app_state blob until its own
   phase migrates it. Whatever vas/schools values happen to still be
   sitting in the blob are ignored entirely — they're stale leftovers,
   not read here on purpose. */
export const fetchAppState = cache(async (): Promise<AppState | null> => {
  const supabase = await createClient();

  const [blobResult, vasResult, schoolsResult] = await Promise.all([
    supabase.from("app_state").select("data").eq("id", 1).single(),
    supabase.from("vas").select("id, name, email, admin, role, color").order("name"),
    supabase.from("schools").select("id, name").order("name"),
  ]);

  if (blobResult.error || !blobResult.data) return null;
  if (vasResult.error) return null;
  if (schoolsResult.error) return null;

  const state = blobResult.data.data as AppState;
  state.vas = (vasResult.data || []).map(mapVaRow);
  state.schools = (schoolsResult.data || []) as School[];

  return state;
});
