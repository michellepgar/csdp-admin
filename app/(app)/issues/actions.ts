"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, type Issue } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function baseIssueRow(reportedBy: string, type: Issue["type"]): Issue {
  return {
    id: `demo-${Date.now()}`,
    type,
    reportedBy,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
}

function baseIssueInsert(me: { name: string }, type: Issue["type"]) {
  return {
    id: crypto.randomUUID(),
    type,
    reported_by: me.name,
    status: "Pending",
  };
}

/* One Add Issue form covers all four types now -- the fields shown
   depend on the "type" the reporter picked, but they all submit here.
   Each branch keeps exactly the same required-field/insert shape the
   old per-type action had. */
export async function addIssue(formData: FormData) {
  const type = (formData.get("type") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      let issue: Issue | null = null;
      if (type === "software_issue") {
        const description = ((formData.get("description") as string) || "").trim();
        if (!description) return;
        issue = { ...baseIssueRow("Jane", "software_issue"), description, category: (formData.get("category") as string) || "", subcategory: (formData.get("subcategory") as string) || "", remarks: (formData.get("note") as string) || "" };
      } else if (type === "correction") {
        const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
        if (!studentRecordLink) return;
        issue = {
          ...baseIssueRow("Jane", "correction"),
          correctionKind: (formData.get("correctionKind") as string) || "Correction",
          studentRecordLink,
          needsNameCorrection: !!formData.get("needsNameCorrection"),
          needsDobCorrection: !!formData.get("needsDobCorrection"),
          needsInsuranceCorrection: !!formData.get("needsInsuranceCorrection"),
          needsOtherCorrection: !!formData.get("needsOtherCorrection"),
          otherCorrectionDetail: (formData.get("otherCorrectionDetail") as string) || "",
          fixedBy: [],
        };
      } else if (type === "charting") {
        const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
        const question = ((formData.get("question") as string) || "").trim();
        if (!studentRecordLink || !question) return;
        issue = { ...baseIssueRow("Jane", "charting"), studentRecordLink, question, fixedBy: [] };
      }
      if (issue) (state.issues ??= []).push(issue);
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  if (type === "software_issue") {
    const description = ((formData.get("description") as string) || "").trim();
    if (!description) return;
    const { error } = await supabase.from("issues").insert({
      ...baseIssueInsert(me, "software_issue"),
      description,
      category: (formData.get("category") as string) || "",
      subcategory: (formData.get("subcategory") as string) || "",
      remarks: (formData.get("note") as string) || "",
    });
    orThrow(error);
  } else if (type === "correction") {
    const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
    if (!studentRecordLink) return;
    const { error } = await supabase.from("issues").insert({
      ...baseIssueInsert(me, "correction"),
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
  } else if (type === "charting") {
    const studentRecordLink = ((formData.get("studentRecordLink") as string) || "").trim();
    const question = ((formData.get("question") as string) || "").trim();
    if (!studentRecordLink || !question) return;
    const { error } = await supabase.from("issues").insert({
      ...baseIssueInsert(me, "charting"),
      student_record_link: studentRecordLink,
      question,
      fixed_by: [],
    });
    orThrow(error);
  } else {
    return;
  }

  revalidatePath("/issues");
}

export async function setIssueStatus(formData: FormData) {
  const id = formData.get("id") as string;
  const status = (formData.get("status") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const issue = (state.issues || []).find((i) => i.id === id);
      if (issue) issue.status = status;
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("issues").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

/* Same rule as canDeleteIssue in lib/app-state.ts (an admin can delete
   anything; otherwise only the reporter can), reimplemented as a
   targeted query instead of fetchAppState()'s full ~19-table fetch. */
export async function removeIssue(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.issues = (state.issues || []).filter((i) => i.id !== id);
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: issue } = await supabase.from("issues").select("reported_by").eq("id", id).maybeSingle();
  if (!issue) return;
  if (!isAdmin(me) && issue.reported_by !== me.name) return;

  const { error } = await supabase.from("issues").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

/* Fix used to be a list of sign-off chips (fixed_by) -- replaced with
   a free-text note anyone can type/update, same auto-save pattern as
   other single-value fields (e.g. setIssueStatus above). */
export async function setIssueFixNote(formData: FormData) {
  const id = formData.get("id") as string;
  const fixNote = (formData.get("fixNote") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const issue = (state.issues || []).find((i) => i.id === id);
      if (issue) issue.fixNote = fixNote;
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("issues").update({ fix_note: fixNote }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

/* Software Issue's own Note (issues.remarks), editable after the fact
   the same way -- not to be confused with Correction/Charting's Fix
   note above (a different column, different meaning). */
export async function setIssueNote(formData: FormData) {
  const id = formData.get("id") as string;
  const note = (formData.get("note") as string) || "";

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const issue = (state.issues || []).find((i) => i.id === id);
      if (issue) issue.remarks = note;
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("issues").update({ remarks: note }).eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

/* ---------- Software Issue Category -> Subcategory list ----------
   Same pattern as Task Categories/Checklist template: a shared,
   editable list (not per-school), sort_order backed. */

export async function addIssueCategory(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.issueCategories ??= []).push({ id: `demo-${Date.now()}`, name, subcategories: [] });
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("issue_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("issue_categories")
    .insert({ id: crypto.randomUUID(), name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/issues");
}

export async function removeIssueCategory(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.issueCategories = (state.issueCategories || []).filter((c) => c.id !== id);
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("issue_categories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}

export async function addIssueSubcategory(formData: FormData) {
  const categoryId = formData.get("categoryId") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name || !categoryId) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const category = (state.issueCategories || []).find((c) => c.id === categoryId);
      if (category) category.subcategories.push({ id: `demo-${Date.now()}`, name });
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { data: maxRow } = await supabase
    .from("issue_subcategories")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("issue_subcategories")
    .insert({ id: crypto.randomUUID(), category_id: categoryId, name, sort_order: nextSortOrder });
  orThrow(error);
  revalidatePath("/issues");
}

export async function removeIssueSubcategory(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const c of state.issueCategories || []) c.subcategories = c.subcategories.filter((s) => s.id !== id);
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("issue_subcategories").delete().eq("id", id);
  orThrow(error);
  revalidatePath("/issues");
}
