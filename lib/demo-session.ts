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
/* This is RAW pre-encoding character count, not the final cookie
   size -- Next's cookie store percent-encodes the value when it
   writes the Set-Cookie header, and JSON is punctuation-heavy enough
   (every quote, colon, comma, brace becomes a 3-byte %XX escape) that
   the encoded size runs noticeably bigger than the raw string. Found
   by direct repro + measurement: a chunk sliced at the old 3500-char
   size measured out to ~1.6x that once encoded -- comfortably over
   browsers' ~4KB-per-cookie ceiling, so the browser silently dropped
   that ENTIRE cookie (confirmed via document.cookie: demo-state-0
   consistently missing while the shorter remainder chunk survived).
   2000 keeps even a worst-case-punctuation chunk safely under 4KB
   once encoded. */
const CHUNK_SIZE = 2000;
const MAX_CHUNKS = 8; // ~16KB of raw JSON across all chunks combined

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
    return JSON.parse(chunks.join("")) as AppState;
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
  /* Plain JSON, not encodeURIComponent(JSON.stringify(...)) -- Next's
     own cookie store already percent-encodes a value once when it
     writes the Set-Cookie header (and decodes it once on read), so
     encoding it here too meant every chunk was encoded TWICE. Found by
     direct repro: a fresh demo session's very first save reliably lost
     its "demo-state-0" chunk (confirmed via document.cookie -- only
     demo-state-1 survived). Root cause: CHUNK_SIZE=3500 was sized
     against the ALREADY-doubly-encoded string, so a full 3500-char
     chunk of that -- being full of literal "%25..." runs from the
     second encoding pass -- landed well past browsers' ~4KB
     per-cookie ceiling and got silently dropped, while the shorter
     remainder chunk happened to survive. Letting the framework do the
     one encoding pass it already does keeps every chunk safely under
     that ceiling. */
  const serialized = JSON.stringify(state);
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
