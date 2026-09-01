"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import {
  findVaByEmail,
  isAdmin,
  canEditSchoolRecords,
  type AppState,
  type SchoolDataEntry,
} from "@/lib/app-state";

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

function ensureSchoolData(state: AppState, schoolId: string): SchoolDataEntry {
  state.schoolData = state.schoolData || {};
  if (!state.schoolData[schoolId]) state.schoolData[schoolId] = { vaAssigned: "" };
  return state.schoolData[schoolId];
}

function revalidateSchool(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
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
  state.checklistProgress[key] = { status: isDone ? "Open" : "Done" };
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function addChecklistTemplateItem(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;
  state.checklistTemplate = state.checklistTemplate || [];
  state.checklistTemplate.push({ id: crypto.randomUUID(), description });
  await saveState(supabase, state);
  revalidatePath("/", "layout");
}

export async function removeChecklistTemplateItem(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  state.checklistTemplate = (state.checklistTemplate || []).filter((i) => i.id !== id);
  await saveState(supabase, state);
  revalidatePath("/", "layout");
}

/* ---------- Tasks ---------- */

export async function addTask(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const category = (formData.get("category") as string) || "";
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return;
  const sd = ensureSchoolData(state, schoolId);
  sd.tasks = sd.tasks || [];
  sd.tasks.push({
    id: crypto.randomUUID(),
    category,
    fileName,
    status: "",
    vaAssigned: [],
    createdAt: new Date().toISOString(),
  });
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function setTaskStatus(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  const task = (sd.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  task.status = status;
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function setTaskCount(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const count = (formData.get("count") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  const task = (sd.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  task.count = count;
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function signTask(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const sd = ensureSchoolData(state, schoolId);
  const task = (sd.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  task.vaAssigned = task.vaAssigned || [];
  if (!task.vaAssigned.includes(me.name)) task.vaAssigned.push(me.name);
  await saveState(supabase, state);
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
  task.vaAssigned = (task.vaAssigned || []).filter((n) => n !== vaName);
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function removeTask(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const taskId = formData.get("taskId") as string;
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  sd.tasks = (sd.tasks || []).filter((t) => t.id !== taskId);
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function addTaskCategory(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  state.taskCategories = state.taskCategories || [];
  state.taskCategories.push({ id: crypto.randomUUID(), name });
  await saveState(supabase, state);
  revalidatePath("/", "layout");
}

export async function removeTaskCategory(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  state.taskCategories = (state.taskCategories || []).filter((c) => c.id !== id);
  await saveState(supabase, state);
  revalidatePath("/", "layout");
}

/* ---------- Email Tracker ---------- */

export async function addEmailItem(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const description = ((formData.get("description") as string) || "").trim();
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me)) || !description) return;
  sd.emailTracker = sd.emailTracker || [];
  sd.emailTracker.push({
    id: crypto.randomUUID(),
    description,
    status: "Needs My Response",
    addedBy: me.name,
    createdAt: new Date().toISOString(),
  });
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function setEmailStatus(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const status = (formData.get("status") as string) || "";
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  const item = (sd.emailTracker || []).find((e) => e.id === itemId);
  if (!item) return;
  item.status = status;
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}

export async function removeEmailItem(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const schoolId = formData.get("schoolId") as string;
  const itemId = formData.get("itemId") as string;
  const sd = ensureSchoolData(state, schoolId);
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;
  sd.emailTracker = (sd.emailTracker || []).filter((e) => e.id !== itemId);
  await saveState(supabase, state);
  revalidateSchool(schoolId);
}
