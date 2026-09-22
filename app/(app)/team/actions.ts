"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamMember } from "@/lib/require-team-member";
import { isAdmin, SUPERADMIN_NAME, type AppState } from "@/lib/app-state";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { DEMO_USER_EMAIL } from "@/lib/demo-app-state";

/* Every action below except setSchoolAssignment used to start with a
   helper that ran fetchAppState() -- the whole app's ~25-table
   Promise.all -- just to check isAdmin() and, in a couple of cases,
   read one field of one record it could have queried directly. That's
   the actual cause of "color assignment and removing VA takes so long
   to save": every click here paid for the entire app's data TWICE
   (once inside the action, again when revalidatePath() re-renders
   right after) -- not network flakiness. Same fix already applied to
   app/(app)/schools/[id]/actions.ts (see its own comment on this).

   requireAdmin() (a single `vas` lookup via requireTeamMember(), plus
   the isAdmin() check) replaces it for every action that doesn't
   genuinely need other state. setSchoolAssignment is the one
   exception below -- schoolData.vaAssigned still lives in the legacy
   app_state JSON blob, not its own column, so mutating it safely
   really does need the full round trip. */
async function requireAdmin() {
  const { supabase, me } = await requireTeamMember();
  if (!isAdmin(me)) throw new Error("Not authorized");
  return { supabase, me };
}

// communicationEditor and schoolData assignments still live in the
// shared blob — they aren't migrating until later phases. vas is never
// written through this anymore (see the vas-table actions below).
async function saveLegacyState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: AppState
) {
  const { error } = await supabase
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function addVa(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      if (state.vas.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
      state.vas.push({ id: `demo-${Date.now()}`, name });
    });
    revalidatePath("/team");
    return;
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("vas").insert({ id: crypto.randomUUID(), name });
  if (error) {
    // 23505 = unique_violation -- two concurrent "Add VA" submissions
    // (or a plain duplicate name) racing each other. Not a real error
    // from the user's perspective, just "that name's already taken".
    if (error.code === "23505") return;
    throw new Error(error.message);
  }
  revalidatePath("/team");
}

type RemoveVaResult = { error: string | null };

/* Removing a team member clears their name off whatever isn't done yet --
   Michelle: "we just want to track what's completed from the removed VA" --
   so a Completed task/general task keeps their name (that's the record of
   who did it), but anything still open (any other status, including never-
   started) has their name taken off, leaving it unassigned rather than
   assigned to someone no longer on the team. Their own plan (Your Plan --
   plan_items) is cleared entirely: none of it is "completed work" to keep,
   it's just workflow state that no longer means anything once they're gone.
   Doesn't touch who a school's own assigned VA is (schoolData.vaAssigned) --
   that still lives in the legacy app_state JSON blob, not its own column
   (see setSchoolAssignment's own comment), and reading/writing it cheaply
   isn't possible without the same ~39-table fetchAppState() this file's
   other actions were just changed to stop paying for on every click. An
   admin can check and fix a school's own assigned VA in School Assignments
   below either way. */
export async function removeVa(formData: FormData): Promise<RemoveVaResult> {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const va = state.vas.find((v) => v.id === id);
      if (!va) return;
      // Removing the demo visitor's own "Jane" row would lock her out
      // of the rest of her own demo session (the next page load's
      // findVaByEmail() check would no longer find her) -- silently
      // refused rather than let a demo click end the demo.
      if (va.email === DEMO_USER_EMAIL) return;
      for (const sd of Object.values(state.schoolData)) {
        for (const task of sd.tasks || []) if (task.status !== "Completed") task.vaAssigned = task.vaAssigned.filter((n) => n !== va.name);
        for (const file of sd.taskFiles || []) for (const assignment of file.categories) if (assignment.status !== "Completed") assignment.vaAssigned = assignment.vaAssigned.filter((n) => n !== va.name);
      }
      for (const task of state.generalTasks || []) if (task.status !== "Completed") task.vaAssigned = task.vaAssigned.filter((n) => n !== va.name);
      state.planItems = (state.planItems || []).filter((p) => p.vaName !== va.name);
      // Their private notes go with them -- Michelle asked for this
      // explicitly ("it's their private notes"), rather than leaving
      // them behind as orphaned rows anyone still on the team could
      // then delete (private_notes.author is a free-text name, not a
      // foreign key, so nothing does this automatically at the
      // database level -- confirmed no ON DELETE CASCADE exists for
      // it, same as every other name-matched, non-relational field in
      // this app).
      state.privateNotes = (state.privateNotes || []).filter((n) => n.author !== va.name);
      state.vas = state.vas.filter((v) => v.id !== id);
    });
    revalidatePath("/team");
    revalidatePath("/private-notes");
    return { error: null };
  }

  const { supabase, me } = await requireAdmin();
  const { data: va } = await supabase.from("vas").select("name").eq("id", id).maybeSingle();
  if (!va) return { error: null };
  // Same guard demo mode already has: removing your own row would lock
  // you out of the app the moment requireTeamMember() next runs, with no
  // in-app way to undo it since only an admin can re-add someone.
  if (id === me.id) return { error: "You can't remove yourself from the team." };

  // Not-Completed school tasks with this VA on them -- each carries the row's
  // own school_id (needed by update_task_assignment below) via its file.
  const { data: openTaskRows, error: openTaskError } = await supabase
    .from("task_file_categories")
    .select("id, va_assigned, task_files!inner(school_id)")
    .contains("va_assigned", [va.name])
    .neq("status", "Completed");
  if (openTaskError) throw new Error(openTaskError.message);
  const touchedSchoolIds = new Set<string>();
  for (const row of openTaskRows ?? []) {
    const schoolId = (row.task_files as unknown as { school_id: string }).school_id;
    const nextAssigned = ((row.va_assigned as string[]) || []).filter((n) => n !== va.name);
    // Same RPC (and the auth/lock/ownership checks it does) every other
    // reassignment already goes through -- not a raw column update.
    const { error } = await supabase.rpc("update_task_assignment", { p_school_id: schoolId, p_task_id: row.id, p_patch: { va_assigned: nextAssigned } });
    if (error) throw new Error(error.message);
    touchedSchoolIds.add(schoolId);
  }

  const { data: openGeneralRows, error: openGeneralError } = await supabase
    .from("general_tasks")
    .select("id, va_assigned")
    .contains("va_assigned", [va.name])
    .neq("status", "Completed");
  if (openGeneralError) throw new Error(openGeneralError.message);
  for (const row of openGeneralRows ?? []) {
    const nextAssigned = ((row.va_assigned as string[]) || []).filter((n) => n !== va.name);
    const { error } = await supabase.from("general_tasks").update({ va_assigned: nextAssigned }).eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  const { error: planItemsError } = await supabase.from("plan_items").delete().eq("va_name", va.name);
  if (planItemsError) throw new Error(planItemsError.message);

  // Their private notes go with them -- Michelle asked for this
  // explicitly ("it's their private notes"), rather than leaving them
  // behind as orphaned rows anyone still on the team could then
  // delete. private_notes.author is a free-text name, not a foreign
  // key to vas (see supabase/phase3_relational_notes.sql), so nothing
  // does this automatically at the database level -- has to happen
  // here.
  const { error: privateNotesError } = await supabase.from("private_notes").delete().eq("author", va.name);
  if (privateNotesError) throw new Error(privateNotesError.message);

  const { error } = await supabase.from("vas").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // A rare, wide-blast-radius admin action (touches whichever schools had
  // open work, General Tasks, and Overview's plan) -- a full revalidate here
  // is the right call, same as this file's other rare actions (rename a
  // category, restore a backup) already do, unlike the routine single-item
  // actions elsewhere in this file that were narrowed for exactly the
  // opposite reason (see requireAdmin's own comment).
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateVaField(formData: FormData) {
  const id = formData.get("id") as string;
  const rawField = formData.get("field") as string;
  const value = ((formData.get("value") as string) || "").trim();
  if (rawField !== "email" && rawField !== "color") return;
  const field = rawField; // narrowed to "email" | "color" by the check above

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const va = state.vas.find((v) => v.id === id);
      if (va) va[field] = value;
    });
    revalidatePath("/team");
    return;
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("vas").update({ [field]: value }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Replaced by updateVaAccess below (phase20) -- Admin Access and
// Communication Access used to be two separate controls (a checkbox list,
// and a single settings-table value naming one VA at a time); they're now
// two checkboxes in one unified table, saved together by one form. Left
// unused rather than deleted since admin-settings' JSON backup/restore
// still round-trips the old `communicationEditor` field for backups taken
// before this changed.
export async function setCommunicationEditor(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = (formData.get("name") as string) || "";

  const { error } = await supabase
    .from("settings")
    .upsert({ key: "communicationEditor", value: { value: name } }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Single form covers both columns per VA (AutoSubmitForm submits the
// whole form on any field's change) -- an unchecked checkbox simply isn't
// present in FormData at all, so its absence (not a "false" value) is
// what means "off" here.
export async function updateVaAccess(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const va = state.vas.find((v) => v.id === id);
      if (!va) return;
      va.admin = va.name === SUPERADMIN_NAME ? true : formData.get("admin") === "on";
      va.communicationAccess = formData.get("communicationAccess") === "on";
    });
    revalidatePath("/team");
    return;
  }

  const { supabase } = await requireAdmin();
  const { data: va } = await supabase.from("vas").select("name").eq("id", id).maybeSingle();

  // Michelle's Admin box renders disabled+locked on the page itself, but
  // that's just UI -- re-asserted here too so a request that skips the
  // page entirely (a replayed/crafted form submission) still can't strip
  // her admin access. Same rule as isAdmin()'s own name check.
  const admin = va?.name === SUPERADMIN_NAME ? true : formData.get("admin") === "on";

  const { error } = await supabase
    .from("vas")
    .update({
      admin,
      communication_access: formData.get("communicationAccess") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function setSchoolAssignment(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const vaName = (formData.get("vaName") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.schoolData[schoolId] ??= { vaAssigned: "" }).vaAssigned = vaName;
    });
    revalidatePath("/team");
    return;
  }

  const { supabase } = await requireAdmin();
  // A narrow read-modify-write against just this one row (not the full
  // ~39-table fetchAppState()) -- still a read-then-write, so two admins
  // saving at the exact same instant can still race, but shrinking the
  // window from "however long the whole app takes to fetch" down to one
  // tiny row read makes that collision far less likely to actually happen.
  const { data: row } = await supabase.from("app_state").select("data").eq("id", 1).maybeSingle();
  if (!row) throw new Error("Couldn't load app state");
  const data = row.data as AppState;
  if (!data.schoolData[schoolId]) data.schoolData[schoolId] = { vaAssigned: "" };
  data.schoolData[schoolId].vaAssigned = vaName;
  await saveLegacyState(supabase, data);
  revalidatePath("/team");
}
