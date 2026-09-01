"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canDeleteIssue, type AppState, type Issue } from "@/lib/app-state";

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

function baseIssue(me: { name: string }, type: Issue["type"]): Issue {
  return {
    id: crypto.randomUUID(),
    type,
    reportedBy: me.name,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
}

export async function addSoftwareIssue(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;
  state.issues = state.issues || [];
  state.issues.push({
    ...baseIssue(me, "software_issue"),
    description,
    category: (formData.get("category") as string) || "",
    remarks: "",
  });
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function addRecordUpdate(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return;
  state.issues = state.issues || [];
  state.issues.push({
    ...baseIssue(me, "record_update"),
    studentName: (formData.get("studentName") as string) || "",
    dob: (formData.get("dob") as string) || "",
    insuranceNumber: (formData.get("insuranceNumber") as string) || "",
    schoolYear: (formData.get("schoolYear") as string) || "",
    fileName,
    pageNumber: (formData.get("pageNumber") as string) || "",
    correctingCategory: (formData.get("correctingCategory") as string) || "",
    correctInfo: (formData.get("correctInfo") as string) || "",
  });
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function addCorrection(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
  if (!studentRecordLink) return;
  state.issues = state.issues || [];
  state.issues.push({
    ...baseIssue(me, "correction"),
    correctionKind: (formData.get("correctionKind") as string) || "Correction",
    studentRecordLink,
    needsNameCorrection: !!formData.get("needsNameCorrection"),
    needsDobCorrection: !!formData.get("needsDobCorrection"),
    needsInsuranceCorrection: !!formData.get("needsInsuranceCorrection"),
    needsOtherCorrection: !!formData.get("needsOtherCorrection"),
    otherCorrectionDetail: (formData.get("otherCorrectionDetail") as string) || "",
    fixedBy: [],
  });
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function addCharting(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
  const question = ((formData.get("question") as string) || "").trim();
  if (!studentRecordLink || !question) return;
  state.issues = state.issues || [];
  state.issues.push({
    ...baseIssue(me, "charting"),
    studentRecordLink,
    question,
    fixedBy: [],
  });
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function setIssueStatus(formData: FormData) {
  const { supabase, state } = await requireUserAndState();
  const id = formData.get("id") as string;
  const status = (formData.get("status") as string) || "";
  const issue = (state.issues || []).find((i) => i.id === id);
  if (!issue) return;
  issue.status = status;
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function removeIssue(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const issue = (state.issues || []).find((i) => i.id === id);
  if (!issue || !canDeleteIssue(issue, me.name, isAdmin(me))) return;
  state.issues = (state.issues || []).filter((i) => i.id !== id);
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function signIssueFix(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const issue = (state.issues || []).find((i) => i.id === id);
  if (!issue) return;
  issue.fixedBy = issue.fixedBy || [];
  if (!issue.fixedBy.includes(me.name)) issue.fixedBy.push(me.name);
  await saveState(supabase, state);
  revalidatePath("/issues");
}

export async function removeIssueFixSignature(formData: FormData) {
  const { supabase, state, me } = await requireUserAndState();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const issue = (state.issues || []).find((i) => i.id === id);
  if (!issue) return;
  if (name !== me.name && !isAdmin(me)) return;
  issue.fixedBy = (issue.fixedBy || []).filter((n) => n !== name);
  await saveState(supabase, state);
  revalidatePath("/issues");
}
