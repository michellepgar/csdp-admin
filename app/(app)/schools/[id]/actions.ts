"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/require-team-member";
import { syncContactRowEmail } from "@/lib/sync-contact-row";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

/* Every action in this file used to start with a helper that ran
   fetchAppState() -- the whole app's ~25-table Promise.all -- just to
   get `me` (and, in most cases, one field of one record it could have
   queried directly). That meant every single click-to-save here paid
   for the entire app's data TWICE: once inside the action, and again
   when revalidatePath() forces the page to re-render right after (see
   fetchAppState()'s own comment on why those two runs can't share a
   cache -- they're genuinely separate requests). That's the actual
   cause behind "it takes time to save" -- not network flakiness.

   requireTeamMember() (a single `vas` lookup) replaces it everywhere;
   anywhere a permission check used to call canEditSchoolRecords() with
   the full state, that check is gone too -- it always returns `true`
   now (see lib/app-state.ts), so fetching state just to feed it was
   pure waste. The handful of actions that genuinely need one existing
   record's current value (an array to append/filter, a school's name)
   fetch just that one row instead of the whole app.

   Every action here also checks isDemoMode() first, before ever
   calling requireTeamMember() (which throws for the demo user -- it
   has no real Supabase session). That branch mutates the demo
   visitor's own cookie-backed state (lib/demo-session.ts) instead of
   the real database, so add/remove/edit all genuinely work in the
   demo without ever touching real data or persisting past sign-out. */

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function revalidateSchool(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
}

/* ---------- Yearly Checklist ---------- */

export async function toggleChecklistItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const key = `${schoolId}:${itemId}`;
      const isDone = state.checklistProgress[key]?.status === "Done";
      state.checklistProgress[key] = isDone ? { status: "Open" } : { status: "Done", checkedBy: "Jane" };
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();
  /* Anyone on the team can check a checklist item off, not just the
     school's assigned VA -- who actually did it is recorded below and
     shown as a small signature, instead of gating who's allowed to. */

  const { data: current } = await supabase
    .from("checklist_progress")
    .select("status")
    .eq("school_id", schoolId)
    .eq("template_item_id", itemId)
    .maybeSingle();
  const isDone = current?.status === "Done";

  const { error } = await supabase
    .from("checklist_progress")
    .upsert(
      { school_id: schoolId, template_item_id: itemId, status: isDone ? "Open" : "Done", checked_by: isDone ? null : me.name },
      { onConflict: "school_id,template_item_id" }
    );
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addChecklistTemplateItem(formData: FormData) {
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.checklistTemplate.push({ id: `demo-${Date.now()}`, description });
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("checklist_template")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("checklist_template")
    .insert({ id: crypto.randomUUID(), description, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/", "layout");
}

export async function removeChecklistTemplateItem(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.checklistTemplate = state.checklistTemplate.filter((t) => t.id !== id);
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("checklist_template").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* ---------- Tasks ---------- */

export async function addTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const category = (formData.get("category") as string) || "";
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      (sd.tasks ??= []).push({ id: `demo-${Date.now()}`, category, fileName, status: "", vaAssigned: [], createdAt: new Date().toISOString() });
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("tasks").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    category,
    file_name: fileName,
    status: "",
    va_assigned: [],
  });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setTaskStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.status = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setTaskCount(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const count = (formData.get("count") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.count = count;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("tasks").update({ count }).eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function signTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task && !task.vaAssigned.includes("Jane")) task.vaAssigned.push("Jane");
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: task } = await supabase.from("tasks").select("va_assigned").eq("id", taskId).maybeSingle();
  if (!task || task.va_assigned.includes(me.name)) return;

  const { error } = await supabase
    .from("tasks")
    .update({ va_assigned: [...task.va_assigned, me.name] })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeVaFromTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.vaAssigned = task.vaAssigned.filter((n) => n !== vaName);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: task } = await supabase.from("tasks").select("va_assigned").eq("id", taskId).maybeSingle();
  if (!task) return;

  const { error } = await supabase
    .from("tasks")
    .update({ va_assigned: (task.va_assigned as string[]).filter((n) => n !== vaName) })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeTask(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      if (sd?.tasks) sd.tasks = sd.tasks.filter((t) => t.id !== taskId);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

/* ---------- Task Communications (Initial/Follow up only) ---------- */

export async function setCommsStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) task.commsStatus = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("tasks").update({ comms_status: status }).eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function signComms(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task) {
        task.commsVaAssigned ??= [];
        if (!task.commsVaAssigned.includes("Jane")) task.commsVaAssigned.push("Jane");
      }
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: task } = await supabase.from("tasks").select("comms_va_assigned").eq("id", taskId).maybeSingle();
  if (!task) return;
  const commsVaAssigned: string[] = task.comms_va_assigned || [];
  if (commsVaAssigned.includes(me.name)) return;

  const { error } = await supabase
    .from("tasks")
    .update({ comms_va_assigned: [...commsVaAssigned, me.name] })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeVaFromComms(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const task = state.schoolData[schoolId]?.tasks?.find((t) => t.id === taskId);
      if (task?.commsVaAssigned) task.commsVaAssigned = task.commsVaAssigned.filter((n) => n !== vaName);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: task } = await supabase.from("tasks").select("comms_va_assigned").eq("id", taskId).maybeSingle();
  if (!task) return;

  const { error } = await supabase
    .from("tasks")
    .update({ comms_va_assigned: ((task.comms_va_assigned as string[]) || []).filter((n) => n !== vaName) })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

/* ---------- No Recheck ---------- */

export async function setNoRecheck(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const noRecheck = formData.get("noRecheck") === "true";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      if (school) school.noRecheck = noRecheck;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("schools").update({ no_recheck: noRecheck }).eq("id", schoolId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addTaskCategory(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.taskCategories ??= []).push({ id: `demo-${Date.now()}`, name });
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("task_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("task_categories")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/", "layout");
}

export async function removeTaskCategory(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.taskCategories = (state.taskCategories || []).filter((c) => c.id !== id);
    });
    revalidatePath("/", "layout");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("task_categories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* ---------- Email Tracker ---------- */

export async function addEmailItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = (state.schoolData[schoolId] ??= { vaAssigned: "" });
      (sd.emailTracker ??= []).push({ id: `demo-${Date.now()}`, description, status: "Needs My Response", addedBy: "Jane", createdAt: new Date().toISOString() });
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    description,
    status: "Needs My Response",
    added_by: me.name,
  });
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setEmailStatus(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const item = state.schoolData[schoolId]?.emailTracker?.find((e) => e.id === itemId);
      if (item) item.status = status;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").update({ status }).eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeEmailItem(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const sd = state.schoolData[schoolId];
      if (sd?.emailTracker) sd.emailTracker = sd.emailTracker.filter((e) => e.id !== itemId);
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("email_tracker_items").delete().eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setSchoolEmailNotes(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const emailNotes = (formData.get("emailNotes") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      if (school) school.emailNotes = emailNotes || undefined;
    });
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("schools").update({ email_notes: emailNotes || null }).eq("id", schoolId);
  orThrow(error);
  revalidateSchool(schoolId);
}

/* Website/hours used to be editable right here (see git history) --
   now only editable from a contact row's edit form on the Contacts
   page (app/(app)/contacts/actions.ts's updateContactRow), which
   updates this same `schools` table. This page only displays them. */

/* ---------- Rename school ---------- */

/* The school page is the only place a school's name can be changed --
   Contacts and Distribution List both only ever show/match it, never
   edit it. Contacts and Distribution List rows aren't linked to a
   school by id, only by this exact name (see removeSchoolAndContacts's
   own comment above), so renaming has to also rewrite every row that
   currently carries the old name to the new one, or they'd silently
   stop matching this school at all -- the contact/distribution info
   would still exist, just orphaned under a name nothing points to
   anymore. */
export async function renameSchool(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const newName = ((formData.get("name") as string) || "").trim();
  if (!newName) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      if (!school || school.name === newName) return;
      const oldName = school.name;
      school.name = newName;
      for (const g of state.contactGroups || []) for (const r of g.rows) if (r.school === oldName) r.school = newName;
      for (const g of state.distributionGroups || []) for (const r of g.rows) if (r.school === oldName) r.school = newName;
    });
    revalidatePath("/", "layout");
    revalidateSchool(schoolId);
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (!school || school.name === newName) return;
  const oldName = school.name;

  const { error } = await supabase.from("schools").update({ name: newName }).eq("id", schoolId);
  orThrow(error);

  const { error: contactsError } = await supabase.from("contact_rows").update({ school: newName }).eq("school", oldName);
  orThrow(contactsError);
  const { error: distributionError } = await supabase.from("distribution_rows").update({ school: newName }).eq("school", oldName);
  orThrow(distributionError);

  revalidatePath("/", "layout");
  revalidateSchool(schoolId);
}

/* ---------- Remove school ---------- */

/* Deletes the school row only. Cascades (via "on delete cascade" FKs)
   remove its tasks, checklist progress, email tracker items, and
   school_contacts automatically. Contacts (contact_rows) and
   Distribution List (distribution_rows) are matched by school NAME,
   not a foreign key, so they're untouched here on purpose -- use
   removeSchoolAndContacts instead to also clear those. */
export async function removeSchool(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.schools = state.schools.filter((s) => s.id !== schoolId);
      delete state.schoolData[schoolId];
    });
    revalidatePath("/", "layout");
    redirect("/overview");
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  orThrow(error);

  revalidatePath("/", "layout");
  redirect("/overview");
}

/* Same as removeSchool, but also deletes this school's row on the
   Contacts page and Distribution List (matched by name, captured
   before the school itself is deleted). */
export async function removeSchoolAndContacts(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const school = state.schools.find((s) => s.id === schoolId);
      state.schools = state.schools.filter((s) => s.id !== schoolId);
      delete state.schoolData[schoolId];
      if (school) {
        for (const g of state.contactGroups || []) g.rows = g.rows.filter((r) => r.school !== school.name);
        for (const g of state.distributionGroups || []) g.rows = g.rows.filter((r) => r.school !== school.name);
      }
    });
    revalidatePath("/", "layout");
    redirect("/overview");
  }

  const { supabase } = await requireTeamMember();
  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  orThrow(error);

  if (school) {
    await supabase.from("contact_rows").delete().eq("school", school.name);
    await supabase.from("distribution_rows").delete().eq("school", school.name);
  }

  revalidatePath("/", "layout");
  redirect("/overview");
}

/* ---------- School Contacts (position + email, editable anytime) ---------- */

export async function addSchoolContact(formData: FormData) {
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.schoolContacts ??= {})[schoolId] ??= [];
      state.schoolContacts[schoolId].push({ id: `demo-${Date.now()}`, position, email, createdAt: new Date().toISOString() });
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("school_contacts").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    position,
    email,
  });
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function updateSchoolContact(formData: FormData) {
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const contact = state.schoolContacts?.[schoolId]?.find((c) => c.id === id);
      if (contact) {
        contact.position = position;
        contact.email = email;
      }
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("school_contacts").update({ position, email }).eq("id", id);
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function removeSchoolContact(formData: FormData) {
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const list = state.schoolContacts?.[schoolId];
      if (list) state.schoolContacts![schoolId] = list.filter((c) => c.id !== id);
    });
    revalidateSchool(schoolId);
    revalidatePath("/contacts");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: existing } = await supabase.from("school_contacts").select("position").eq("id", id).maybeSingle();

  const { error } = await supabase.from("school_contacts").delete().eq("id", id);
  orThrow(error);

  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (school && existing) await syncContactRowEmail(supabase, schoolId, school.name, existing.position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}
