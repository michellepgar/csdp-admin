"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, ISSUE_TYPE_LABELS, NO_SUBCATEGORY, type Issue } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { extractMentionedNames, snippetFromHtml } from "@/lib/mentions";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";

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
        issue = { ...baseIssueRow("Jane", "software_issue"), description, category: (formData.get("category") as string) || "", subcategory: (formData.get("subcategory") as string) || NO_SUBCATEGORY, remarks: (formData.get("note") as string) || "" };
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
      } else if (type === "custom") {
        const customTypeId = ((formData.get("customTypeId") as string) || "").trim();
        const description = ((formData.get("description") as string) || "").trim();
        if (!description || !(state.issueTypes || []).some((t) => t.id === customTypeId)) return;
        issue = { ...baseIssueRow("Jane", "custom"), customTypeId, description, remarks: (formData.get("note") as string) || "" };
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
      subcategory: (formData.get("subcategory") as string) || NO_SUBCATEGORY,
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
  } else if (type === "custom") {
    const customTypeId = ((formData.get("customTypeId") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim();
    if (!description || !customTypeId) return;
    const { error } = await supabase.from("issues").insert({
      ...baseIssueInsert(me, "custom"),
      custom_type_id: customTypeId,
      description,
      remarks: (formData.get("note") as string) || "",
    });
    orThrow(error);
  } else {
    return;
  }

  revalidatePath("/issues");
}

/* The team's own issue types (Issues & Concerns page), next to the built-in
   Software Issue / Correction / Charting. Return {error} rather than throwing
   so a duplicate name reads as a message instead of a redacted server error. */
type IssueTypeResult = { error: string | null };

export async function addIssueType(formData: FormData): Promise<IssueTypeResult> {
  const name = ((formData.get("name") as string) || "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Type a name for the new type." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  const lower = name.toLowerCase();
  if (Object.values(ISSUE_TYPE_LABELS).some((label) => label.toLowerCase() === lower) || lower === "correction / verification" || lower === "charting questions") {
    return { error: `"${name}" is already a type.` };
  }

  if (await isDemoMode()) {
    let duplicate = false;
    await demoMutate((state) => {
      if ((state.issueTypes || []).some((t) => t.name.toLowerCase() === lower)) {
        duplicate = true;
        return;
      }
      (state.issueTypes ??= []).push({ id: `demo-type-${Date.now()}`, name });
    });
    if (duplicate) return { error: `"${name}" is already a type.` };
    revalidatePath("/", "layout");
    return { error: null };
  }

  try {
    const { supabase } = await requireTeamMember();
    const { data: existing } = await supabase.from("issue_types").select("id").ilike("name", name).maybeSingle();
    if (existing) return { error: `"${name}" is already a type.` };
    const { data: maxRow } = await supabase.from("issue_types").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("issue_types").insert({ id: crypto.randomUUID(), name, sort_order: (maxRow?.sort_order ?? -1) + 1 });
    if (error) return { error: error.message.includes("issue_types") ? "The new issue types feature needs its database update first (phase66_issue_types.sql)." : error.message };
  } catch (error) {
    console.error("Add issue type failed", error);
    return { error: "The type could not be added. Please try again." };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeIssueType(formData: FormData): Promise<IssueTypeResult> {
  const id = ((formData.get("id") as string) || "").trim();
  if (!id) return { error: "Choose a type to remove." };

  if (await isDemoMode()) {
    let inUse = false;
    await demoMutate((state) => {
      if ((state.issues || []).some((i) => i.customTypeId === id)) {
        inUse = true;
        return;
      }
      state.issueTypes = (state.issueTypes || []).filter((t) => t.id !== id);
    });
    if (inUse) return { error: "Issues are still filed under this type. Remove them first." };
    revalidatePath("/", "layout");
    return { error: null };
  }

  try {
    const { supabase } = await requireTeamMember();
    const { count, error: countError } = await supabase.from("issues").select("id", { count: "exact", head: true }).eq("custom_type_id", id);
    if (countError) return { error: countError.message };
    if (count) return { error: "Issues are still filed under this type. Remove them first." };
    const { error } = await supabase.from("issue_types").delete().eq("id", id);
    if (error) return { error: error.message };
  } catch (error) {
    console.error("Remove issue type failed", error);
    return { error: "The type could not be removed. Please try again." };
  }
  revalidatePath("/", "layout");
  return { error: null };
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

/* A comment thread per issue, replacing the old single free-text Note/
   Fix field (see components/issue-comments.tsx) -- addIssueComment
   resets comment_ack_by to just the poster's own name on every new
   comment, which is what makes the "new comment" dot blink again for
   everyone else; ackIssueComments (called when a VA opens the
   dropdown) adds them to that list, clearing it for them. */
export async function addIssueComment(formData: FormData) {
  const issueId = formData.get("issueId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const issue = (state.issues || []).find((i) => i.id === issueId);
      if (!issue) return;
      (issue.comments ??= []).push({ id: `demo-${Date.now()}`, author: "Jane", text: sanitizeNoteHtml(text, state.vas || []), createdAt: new Date().toISOString() });
      issue.commentAckBy = ["Jane"];
      const mentioned = extractMentionedNames(text, (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane");
      for (const name of mentioned) {
        (state.mentions ??= []).push({
          id: `demo-${Date.now()}-${name}`,
          mentionedName: name,
          mentionerName: "Jane",
          source: "issue_comment",
          issueId,
          snippet: snippetFromHtml(text),
          createdAt: new Date().toISOString(),
        });
      }
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const roster = vasData || [];
  const html = sanitizeNoteHtml(text, roster);

  const { error } = await supabase.from("issue_comments").insert({ id: crypto.randomUUID(), issue_id: issueId, author: me.name, text: html });
  orThrow(error);
  const { error: ackError } = await supabase.from("issues").update({ comment_ack_by: [me.name] }).eq("id", issueId);
  orThrow(ackError);

  const mentioned = extractMentionedNames(snippetFromHtml(text), roster.map((v) => v.name)).filter((n) => n !== me.name);
  if (mentioned.length > 0) {
    const { error: mentionsError } = await supabase.from("mentions").insert(
      mentioned.map((name) => ({
        id: crypto.randomUUID(),
        mentioned_name: name,
        mentioner_name: me.name,
        source: "issue_comment",
        issue_id: issueId,
        snippet: snippetFromHtml(text),
      }))
    );
    orThrow(mentionsError);
  }

  revalidatePath("/issues");
}

/* Author-only, same rule as General Notes' updateGeneralNote -- no
   admin exception, nobody else can change what someone else wrote.
   Re-parses mentions the same way updateGeneralNote does: only NEWLY
   added names get a fresh mentions row, so re-saving an edit that
   still mentions someone already mentioned doesn't re-notify them. */
export async function editIssueComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const issue of state.issues || []) {
        const comment = (issue.comments || []).find((c) => c.id === commentId);
        if (!comment || comment.author !== "Jane") continue;
        const alreadyMentioned = new Set((state.mentions || []).filter((m) => m.issueId === issue.id).map((m) => m.mentionedName));
        comment.text = sanitizeNoteHtml(text, state.vas || []);
        comment.editedAt = new Date().toISOString();
        const mentioned = extractMentionedNames(text, (state.vas || []).map((v) => v.name)).filter((n) => n !== "Jane" && !alreadyMentioned.has(n));
        for (const name of mentioned) {
          (state.mentions ??= []).push({
            id: `demo-${Date.now()}-${name}`,
            mentionedName: name,
            mentionerName: "Jane",
            source: "issue_comment",
            issueId: issue.id,
            snippet: snippetFromHtml(text),
            createdAt: new Date().toISOString(),
          });
        }
        return;
      }
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("issue_comments").select("author, issue_id").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { data: vasData } = await supabase.from("vas").select("name, color");
  const roster = vasData || [];
  const html = sanitizeNoteHtml(text, roster);

  const { error } = await supabase.from("issue_comments").update({ text: html, edited_at: new Date().toISOString() }).eq("id", commentId);
  orThrow(error);

  const { data: existingMentions } = await supabase.from("mentions").select("mentioned_name").eq("issue_id", comment.issue_id);
  const alreadyMentioned = new Set((existingMentions || []).map((m) => m.mentioned_name));
  const mentioned = extractMentionedNames(snippetFromHtml(text), roster.map((v) => v.name)).filter((n) => n !== me.name && !alreadyMentioned.has(n));
  if (mentioned.length > 0) {
    const { error: mentionsError } = await supabase.from("mentions").insert(
      mentioned.map((name) => ({
        id: crypto.randomUUID(),
        mentioned_name: name,
        mentioner_name: me.name,
        source: "issue_comment",
        issue_id: comment.issue_id,
        snippet: snippetFromHtml(text),
      }))
    );
    orThrow(mentionsError);
  }

  revalidatePath("/issues");
}

/* Author-only, same as editIssueComment. Doesn't clean up any
   mentions row this comment may have created -- mentions record which
   ISSUE a mention happened on, not which specific comment, so there's
   nothing precise to delete; the mention stays as a record that the
   mentioned person was once called out on this issue, same as the
   rest of this app's minimal mention-lifecycle handling. */
export async function removeIssueComment(formData: FormData) {
  const commentId = formData.get("commentId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      for (const issue of state.issues || []) {
        const before = (issue.comments || []).length;
        issue.comments = (issue.comments || []).filter((c) => !(c.id === commentId && c.author === "Jane"));
        if (issue.comments.length !== before) return;
      }
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: comment } = await supabase.from("issue_comments").select("author").eq("id", commentId).maybeSingle();
  if (!comment || comment.author !== me.name) return;

  const { error } = await supabase.from("issue_comments").delete().eq("id", commentId);
  orThrow(error);
  revalidatePath("/issues");
}

export async function ackIssueComments(formData: FormData) {
  const issueId = formData.get("issueId") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const issue = (state.issues || []).find((i) => i.id === issueId);
      if (!issue) return;
      issue.commentAckBy ??= [];
      if (!issue.commentAckBy.includes("Jane")) issue.commentAckBy.push("Jane");
    });
    revalidatePath("/issues");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: issue } = await supabase.from("issues").select("comment_ack_by").eq("id", issueId).maybeSingle();
  if (!issue) return;
  const ackBy: string[] = issue.comment_ack_by || [];
  if (ackBy.includes(me.name)) return;

  const { error } = await supabase.from("issues").update({ comment_ack_by: [...ackBy, me.name] }).eq("id", issueId);
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
