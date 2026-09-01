"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canEditSchoolRecords, type AppState } from "@/lib/app-state";

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

function performRemoval(state: AppState, recordKind: string, schoolId: string, targetId: string) {
  const sd = state.schoolData[schoolId];
  if (!sd) return;
  if (recordKind === "task") {
    sd.tasks = (sd.tasks || []).filter((t) => t.id !== targetId);
  } else if (recordKind === "email-item") {
    sd.emailTracker = (sd.emailTracker || []).filter((e) => e.id !== targetId);
  }
}

export async function approveAccessRequest(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const req = (state.accessRequests || []).find((r) => r.id === id);
  if (!req) return;
  const sd = state.schoolData[req.schoolId];
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  performRemoval(state, req.recordKind, req.schoolId, req.targetId);
  req.status = "fulfilled";
  req.resolvedBy = me.name;
  req.resolvedAt = new Date().toISOString();

  await saveState(supabase, state);
  revalidatePath("/approvals");
  revalidatePath(`/schools/${req.schoolId}`);
}

export async function declineAccessRequest(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const req = (state.accessRequests || []).find((r) => r.id === id);
  if (!req) return;
  const sd = state.schoolData[req.schoolId];
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  req.status = "declined";
  req.resolvedBy = me.name;
  req.resolvedAt = new Date().toISOString();

  await saveState(supabase, state);
  revalidatePath("/approvals");
}

export async function deleteAccessRequestRow(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const req = (state.accessRequests || []).find((r) => r.id === id);
  if (!req) return;

  const isMine = req.requestedBy === me.name;
  const sd = state.schoolData[req.schoolId];
  const canManage = req.status !== "pending" && canEditSchoolRecords(sd, me.name, isAdmin(me));
  if (!isMine && !canManage) return;

  state.accessRequests = (state.accessRequests || []).filter((r) => r.id !== id);
  await saveState(supabase, state);
  revalidatePath("/approvals");
}
