"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
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

export async function removeVa(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      // Removing the demo visitor's own "Jane" row would lock her out
      // of the rest of her own demo session (the next page load's
      // findVaByEmail() check would no longer find her) -- silently
      // refused rather than let a demo click end the demo.
      state.vas = state.vas.filter((v) => v.id === id ? v.email !== DEMO_USER_EMAIL : true);
    });
    revalidatePath("/team");
    return;
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("vas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
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
  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");
  if (!state.schoolData[schoolId]) state.schoolData[schoolId] = { vaAssigned: "" };
  state.schoolData[schoolId].vaAssigned = vaName;
  await saveLegacyState(supabase, state);
  revalidatePath("/team");
}
