"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, type AppState, type Va, type School } from "@/lib/app-state";

async function requireAdminAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) throw new Error("Not authorized");

  return { supabase, state };
}

async function saveState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: AppState
) {
  const { error } = await supabase
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isValidVaRow(v: unknown): v is Va {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Va).id === "string" &&
    (v as Va).id.length > 0 &&
    typeof (v as Va).name === "string" &&
    (v as Va).name.length > 0
  );
}

function isValidSchoolRow(s: unknown): s is School {
  return (
    !!s &&
    typeof s === "object" &&
    typeof (s as School).id === "string" &&
    (s as School).id.length > 0 &&
    typeof (s as School).name === "string" &&
    (s as School).name.length > 0
  );
}

export async function restoreBackup(formData: FormData) {
  const { supabase } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESTORE") return;

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return;
  }
  /* Sanity check before touching anything: a real backup always has
     non-empty vas and schools arrays, and every row in them must at
     least look like a real Va/School (non-empty id + name) — vas and
     schools now live in their own tables, and this restore
     deletes-then-reinserts both, so a malformed file must be rejected
     upfront rather than partway through, or it can leave a table
     wiped with nothing valid to put back. The length checks matter as
     much as the row-shape checks: an EMPTY array passes `.every(...)`
     vacuously (there are no invalid rows in nothing), so without them
     a backup with an empty vas/schools array would sail through
     validation and still wipe the table with nothing to restore —
     this happened for real during Phase 1's rollout. */
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as AppState).vas) ||
    (parsed as AppState).vas.length === 0 ||
    !(parsed as AppState).vas.every(isValidVaRow) ||
    !Array.isArray((parsed as AppState).schools) ||
    (parsed as AppState).schools.length === 0 ||
    !(parsed as AppState).schools.every(isValidSchoolRow)
  ) {
    return;
  }

  const backup = parsed as AppState;

  /* vas and schools now live in their own tables (Phase 1 of the
     relational backend migration) — a restore has to replace those
     tables' contents too, not just the blob, or restoring a backup
     would silently leave Team/Schools untouched.

     This has to go through the restore_vas_and_schools() database
     function rather than a plain delete-then-insert from here: vas's
     own security policy checks "does any row in vas match my email?",
     so the instant a plain delete empties the table, that check starts
     failing — including for the very insert meant to repopulate it.
     The delete would commit, the insert would get rejected, and vas
     would be left permanently empty (this happened for real during
     Phase 1's rollout). The database function does both steps as one
     security definer operation, sidestepping that empty-table window
     entirely. Rows are still mapped to their known columns before
     being handed to it, since an unrecognized JSON key would otherwise
     make the insert inside that function fail. */
  const vasRows = backup.vas.map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    admin: v.admin,
    role: v.role,
    color: v.color,
  }));
  const schoolRows = backup.schools.map((s) => ({ id: s.id, name: s.name }));
  const { error: restoreError } = await supabase.rpc("restore_vas_and_schools", {
    new_vas: vasRows,
    new_schools: schoolRows,
  });
  orThrow(restoreError);

  /* vas/schools are still included in this blob write even though
     fetchAppState() never reads them back out (they're stale, unused
     leftovers per that file's own comment) — harmless, just dead
     bytes, not worth special-casing out of `backup` for this rarely-run
     admin action. */
  await saveState(supabase, backup);
  revalidatePath("/", "layout");
}

export async function resetAllTasks(formData: FormData) {
  const { supabase, state } = await requireAdminAndState();
  const confirm = (formData.get("confirm") as string) || "";
  if (confirm !== "RESET") return;

  Object.values(state.schoolData || {}).forEach((sd) => {
    sd.tasks = [];
  });
  state.checklistProgress = {};

  await saveState(supabase, state);
  revalidatePath("/", "layout");
}
