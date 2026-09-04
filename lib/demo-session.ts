import { cookies } from "next/headers";
import type { AppState } from "@/lib/app-state";
import { DEMO_APP_STATE } from "@/lib/demo-app-state";

/* The demo account's own "database" -- a full AppState, seeded from
   DEMO_APP_STATE and then mutated in place by whichever add/remove/
   edit action the demo visitor actually uses, entirely separate from
   the demo-mode cookie that just marks "this visitor is Jane."

   Stored as cookies rather than in the real Supabase project: a real
   write there would need its own schema changes to keep every demo
   visitor's changes from colliding with each other (and with the real
   data), where a cookie is naturally already scoped to one browser
   with no server-side bookkeeping at all.

   A single cookie is capped at ~4KB by browsers (RFC 6265), and the
   base sample data alone is already close to that once JSON-encoded --
   confirmed directly (the very first demo write failed under the
   original single-cookie design). Split across several numbered
   cookies instead (demo-state-0, demo-state-1, ...), each comfortably
   under that per-cookie ceiling, giving much more real headroom in
   total. Once the combined size would need more chunks than
   MAX_CHUNKS allows, further adds are politely refused rather than
   silently corrupting anything -- this is also plainly the
   deliberately-limited "not the full software" ceiling Michelle asked
   for, not just a technical detail.

   Signing out (components/sign-out-button.tsx) clears these cookies
   alongside demo-mode, so the next demo visitor -- or the same one,
   starting over -- always begins from the same pristine sample data. */

const COOKIE_PREFIX = "demo-state-";
const MAX_AGE = 2592000; // 30 days, matches the demo-mode cookie
const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 8; // ~28KB ceiling across all chunks combined

export async function isDemoMode(): Promise<boolean> {
  return (await cookies()).get("demo-mode")?.value === "1";
}

export async function getDemoState(): Promise<AppState> {
  const cookieStore = await cookies();
  const chunks: string[] = [];
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const chunk = cookieStore.get(`${COOKIE_PREFIX}${i}`)?.value;
    if (chunk === undefined) break;
    chunks.push(chunk);
  }
  if (chunks.length === 0) return structuredClone(DEMO_APP_STATE);
  try {
    return JSON.parse(decodeURIComponent(chunks.join(""))) as AppState;
  } catch {
    // Corrupt/truncated cookie (shouldn't happen, but a demo session
    // with a broken save shouldn't just crash every page) -- reset to
    // the pristine sample data instead.
    return structuredClone(DEMO_APP_STATE);
  }
}

/* Throws a friendly, demo-specific message (shown as-is by
   app/error.tsx) rather than silently dropping the change when the
   new state would no longer fit in the available chunks. */
export async function saveDemoState(state: AppState): Promise<void> {
  const serialized = encodeURIComponent(JSON.stringify(state));
  const chunkCount = Math.ceil(serialized.length / CHUNK_SIZE);
  if (chunkCount > MAX_CHUNKS) {
    throw new Error("This demo has a small limit on how much you can add — sign up for a real account for the full thing.");
  }

  const cookieStore = await cookies();
  for (let i = 0; i < chunkCount; i++) {
    cookieStore.set(`${COOKIE_PREFIX}${i}`, serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), {
      path: "/",
      maxAge: MAX_AGE,
      sameSite: "lax",
    });
  }
  // Clear any leftover chunks from a previous, larger save (e.g. after
  // removing something) so getDemoState() doesn't later reassemble a
  // stale tail onto the end of the new, shorter state.
  for (let i = chunkCount; i < MAX_CHUNKS; i++) {
    if (!cookieStore.get(`${COOKIE_PREFIX}${i}`)) break;
    cookieStore.set(`${COOKIE_PREFIX}${i}`, "", { path: "/", maxAge: 0 });
  }
}

/* The one primitive every demo-aware action actually uses: read the
   current demo state, let `mutator` change it in place (push into an
   array, splice one out, flip a field -- whatever that action's real
   Supabase call would have done), then save it back. Keeping this as
   a single generic helper (rather than a named function per list --
   demoAddTask, demoRemoveSuggestion, demoAddIssue, and a dozen more)
   is what makes adding this to every action file's own add/remove/
   edit actions a small, consistent addition instead of a much bigger
   one. */
export async function demoMutate(mutator: (state: AppState) => void): Promise<void> {
  const state = await getDemoState();
  mutator(state);
  await saveDemoState(state);
}
