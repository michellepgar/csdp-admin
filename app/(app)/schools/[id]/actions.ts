"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  isAdmin,
  canEditSchoolRecords,
  type AppState,
  type SchoolDataEntry,
} from "@/lib/app-state";
import { syncContactRowEmail } from "@/lib/sync-contact-row";

async function requireUserAndState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not signed in");

  const state = await fetchAppState();
  if (!state) throw new Error("Couldn't load app state");

  const me = findVaByEmail(state, user.email);
  if (!me) throw new Error("Not on the team list");

  return { supabase, state, me };
}

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function ensureSchoolData(state: AppState, schoolId: string): SchoolDataEntry {
  state.schoolData = state.schoolData || {};
  if (!state.schoolData[schoolId]) state.schoolData[schoolId] = { vaAssigned: "" };
  return state.schoolData[schoolId];
}

function revalidateSchool(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
}

/* Anyone can hit "remove" on a task/email item that isn't theirs to
   delete directly — this is what actually happens then: a request to
   whoever manages the school, resolved on the Approvals page. Same
   behavior for both, since the removeTask/removeEmailItem actions
   themselves already silently no-op when not permitted. */
export async function requestRemoval(formData: FormData) {
  const { supabase, me } = await requireUserAndState();
  const recordKind = formData.get("recordKind") as string;
  const schoolId = formData.get("schoolId") as string;
  const targetId = formData.get("targetId") as string;
  const label = (formData.get("label") as string) || "";
  const reason = ((formData.get("reason") as string) || "").trim();
  if (!reason || (recordKind !== "task" && recordKind !== "email-item")) return;

  const { error } = await supabase.from("access_requests").insert({
    id: crypto.randomUUID(),
    record_kind: recordKind,
    school_id: schoolId,
    target_id: targetId,
    label,
    reason,
    requested_by: me.name,
    status: "pending",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}

/* ---------- Yearly Checklist ---------- */

export async function toggleChecklistItem(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const sd = ensureSchoolData(state, schoolId);
  /* No admin override here — matches the HTML app exactly: only the VA
     actually assigned to this school can check items off. */
  if (!sd.vaAssigned || sd.vaAssigned !== me.name) return;

  const key = `${schoolId}:${itemId}`;
  const current = state.checklistProgress[key];
  const isDone = current && current.status === "Done";

  const { error } = await supabase
    .from("checklist_progress")
    .upsert(
      { school_id: schoolId, template_item_id: itemId, status: isDone ? "Open" : "Done" },
      { onConflict: "school_id,template_item_id" }
    );
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addChecklistTemplateItem(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

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
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("checklist_template").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* ---------- Tasks ---------- */

export async function addTask(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const category = (formData.get("category") as string) || "";
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return;

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
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function setTaskCount(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const count = (formData.get("count") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("tasks").update({ count }).eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function signTask(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const sd = ensureSchoolData(state, schoolId);
  const task = (sd.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  if (task.vaAssigned.includes(me.name)) return;

  const { error } = await supabase
    .from("tasks")
    .update({ va_assigned: [...task.vaAssigned, me.name] })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeVaFromTask(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const vaName = formData.get("vaName") as string;
  const sd = ensureSchoolData(state, schoolId);
  /* Removing your own signature is always allowed; removing someone
     else's needs the same permission as editing the record at all. */
  if (vaName !== me.name && !canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  const task = (sd.tasks || []).find((t) => t.id === taskId);
  if (!task) return;

  const { error } = await supabase
    .from("tasks")
    .update({ va_assigned: task.vaAssigned.filter((n) => n !== vaName) })
    .eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeTask(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function addTaskCategory(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

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
  const { supabase } = await requireUserAndState();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("task_categories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/", "layout");
}

/* ---------- Email Tracker ---------- */

export async function addEmailItem(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me)) || !description) return;

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
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const status = (formData.get("status") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("email_tracker_items").update({ status }).eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

export async function removeEmailItem(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  const { error } = await supabase.from("email_tracker_items").delete().eq("id", itemId);
  orThrow(error);
  revalidateSchool(schoolId);
}

/* ---------- School details (website/hours) ---------- */

export async function updateSchoolDetails(formData: FormData) {
  const { supabase } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const website = ((formData.get("website") as string) || "").trim();
  const hours = ((formData.get("hours") as string) || "").trim();

  const { error } = await supabase
    .from("schools")
    .update({ website: website || null, hours: hours || null })
    .eq("id", schoolId);
  orThrow(error);
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
  const { supabase } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  orThrow(error);

  revalidatePath("/", "layout");
  redirect("/overview");
}

/* Same as removeSchool, but also deletes this school's row on the
   Contacts page and Distribution List (matched by name, captured
   before the school itself is deleted). */
export async function removeSchoolAndContacts(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const school = state.schools.find((s) => s.id === schoolId);

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
  const { supabase, state } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  const { error } = await supabase.from("school_contacts").insert({
    id: crypto.randomUUID(),
    school_id: schoolId,
    position,
    email,
  });
  orThrow(error);

  const school = state.schools.find((s) => s.id === schoolId);
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function updateSchoolContact(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;
  const position = (formData.get("position") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();
  if (!email) return;

  const { error } = await supabase.from("school_contacts").update({ position, email }).eq("id", id);
  orThrow(error);

  const school = state.schools.find((s) => s.id === schoolId);
  if (school) await syncContactRowEmail(supabase, schoolId, school.name, position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}

export async function removeSchoolContact(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const schoolId = formData.get("schoolId") as string;

  const { data: existing } = await supabase.from("school_contacts").select("position").eq("id", id).maybeSingle();

  const { error } = await supabase.from("school_contacts").delete().eq("id", id);
  orThrow(error);

  const school = state.schools.find((s) => s.id === schoolId);
  if (school && existing) await syncContactRowEmail(supabase, schoolId, school.name, existing.position);
  revalidateSchool(schoolId);
  revalidatePath("/contacts");
}
