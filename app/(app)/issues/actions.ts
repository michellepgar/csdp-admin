"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, type Issue } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function baseIssueRow(me: { name: string }, type: Issue["type"]) {
  return {
    id: crypto.randomUUID(),
    type,
    reported_by: me.name,
    status: "Pending",
  };
}

export async function addSoftwareIssue(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return;

  const { error } = await supabase.from("issues").insert({
    ...baseIssueRow(me, "software_issue"),
    description,
    category: (formData.get("category") as string) || "",
    remarks: "",
  });
  orThrow(error);
  revalidatePath("/issues");
}

export async function addRecordUpdate(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const fileName = ((formData.get("fileName") as string) || "").trim();
  if (!fileName) return;

  const { error } = await supabase.from("issues").insert({
    ...baseIssueRow(me, "record_update"),
    student_name: (formData.get("studentName") as string) || "",
    dob: (formData.get("dob") as string) || "",
    insurance_number: (formData.get("insuranceNumber") as string) || "",
    school_year: (formData.get("schoolYear") as string) || "",
    file_name: fileName,
    page_number: (formData.get("pageNumber") as string) || "",
    correcting_category: (formData.get("correctingCategory") as string) || "",
    correct_info: (formData.get("correctInfo") as string) || "",
  });
  orThrow(error);
  revalidatePath("/issues");
}

export async function addCorrection(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
  if (!studentRecordLink) return;

  const { error } = await supabase.from("issues").insert({
    ...baseIssueRow(me, "correction"),
    correction_kind: (formData.get("correctionKind") as string) || "Correction",
    student_record_link: studentRecordLink,
    needs_name_correction: !!formData.get("needsNameCorrection"),
    needs_dob_correction: !!formData.get("needsDobCorrection"),
    needs_insurance_correction: !!formData.get("needsInsuranceCorrection"),
    needs_other_correction: !!formData.get("needsOtherCorrection"),
    other_correction_detail: (formData.get("otherCorrectionDetail") as string) || "",
    fixed_by: [],
  });
  orThrow(error);
  revalidatePath("/issues");
}

export async function addCharting(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
  const question = ((formData.get("question") as string) || "").trim();
  if (!studentRecordLink || !question) return;

  const { error } = await supabase.from("issues").insert({
    ...baseIssueRow(me, "charting"),
    student_record_link: studentRecordLink,
    question,
    fixed_by: [],
  });
  orThrow(error);
  revalidatePath("/issues");
}

export async function setIssueStatus(formData: FormData) {
  const { supabase } = await requireTeamMember();
  const id = formData.get("id") as string;
  const status = (formData.get("status") as string) || "";

  const { error } = await supabase.from("issues").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

/* Same rule as canDeleteIssue in lib/app-state.ts (an admin can delete
   anything; otherwise only the reporter can), reimplemented as a
   targeted query instead of fetchAppState()'s full ~19-table fetch. */
export async function removeIssue(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { data: issue } = await supabase.from("issues").select("reported_by").eq("id", id).maybeSingle();
  if (!issue) return;
  if (!isAdmin(me) && issue.reported_by !== me.name) return;

  const { error } = await supabase.from("issues").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

export async function signIssueFix(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const id = formData.get("id") as string;

  const { data: issue } = await supabase.from("issues").select("fixed_by").eq("id", id).maybeSingle();
  if (!issue) return;
  const fixedBy: string[] = issue.fixed_by || [];
  if (fixedBy.includes(me.name)) return;

  const { error } = await supabase.from("issues").update({ fixed_by: [...fixedBy, me.name] }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

export async function removeIssueFixSignature(formData: FormData) {
  const { supabase, me } = await requireTeamMember();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (name !== me.name && !isAdmin(me)) return;

  const { data: issue } = await supabase.from("issues").select("fixed_by").eq("id", id).maybeSingle();
  if (!issue) return;

  const { error } = await supabase
    .from("issues")
    .update({ fixed_by: ((issue.fixed_by as string[]) || []).filter((n) => n !== name) })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}
