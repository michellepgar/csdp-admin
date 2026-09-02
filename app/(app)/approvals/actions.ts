"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canEditSchoolRecords } from "@/lib/app-state";

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

/* Tasks and Email Tracker items live in their own tables (Phase 2) --
   this used to mutate the blob's schoolData[schoolId].tasks/
   .emailTracker arrays, which fetchAppState() no longer reads back out
   at all once those tables took over. That mutation had gone silently
   inert: approving a removal request stopped actually deleting
   anything. Fixed by deleting the real row from the real table. */
async function performRemoval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordKind: string,
  targetId: string
) {
  if (recordKind === "task") {
    const { error } = await supabase.from("tasks").delete().eq("id", targetId);
    orThrow(error);
  } else if (recordKind === "email-item") {
    const { error } = await supabase.from("email_tracker_items").delete().eq("id", targetId);
    orThrow(error);
  }
}

export async function approveAccessRequest(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const req = (state.accessRequests || []).find((r) => r.id === id);
  if (!req) return;
  const sd = state.schoolData[req.schoolId];
  if (!canEditSchoolRecords(sd, me.name, isAdmin(me))) return;

  await performRemoval(supabase, req.recordKind, req.targetId);

  const { error } = await supabase
    .from("access_requests")
    .update({ status: "fulfilled", resolved_by: me.name, resolved_at: new Date().toISOString() })
    .eq("id", id);
  orThrow(error);

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

  const { error } = await supabase
    .from("access_requests")
    .update({ status: "declined", resolved_by: me.name, resolved_at: new Date().toISOString() })
    .eq("id", id);
  orThrow(error);
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

  const { error } = await supabase.from("access_requests").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/approvals");
}
