"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isMyWorkspaceUser } from "@/lib/my-workspace-access";
import { parseDocumentExtractionsJson, type DocumentExtractionStatus } from "@/lib/document-extractions";

const VALID_STATUSES: DocumentExtractionStatus[] = ["pending_review", "approved", "encoded", "rejected"];

/* Same shape as requireAdmin() in app/(app)/team/actions.ts -- a
   thin wrapper around requireTeamMember() that also enforces "and
   are you specifically allowed to use this page." */
async function requireMyWorkspaceUser() {
  const { supabase, me } = await requireTeamMember();
  if (!isMyWorkspaceUser(me.email)) throw new Error("Not authorized");
  return { supabase, me };
}

export async function importDocumentExtractions(formData: FormData): Promise<{ error: string | null; imported: number }> {
  const raw = (formData.get("json") as string) || "";
  const result = parseDocumentExtractionsJson(raw);
  if ("error" in result) return { error: result.error, imported: 0 };

  const { supabase, me } = await requireMyWorkspaceUser();

  const rows = result.documents.map((doc) => ({
    id: crypto.randomUUID(),
    owner: me.name,
    document_name: doc.documentName,
    document_type: doc.documentType,
    school: doc.school || null,
    summary: doc.summary,
    fields: doc.fields,
    flags: doc.flags,
    status: "pending_review",
  }));

  const { error } = await supabase.from("document_extractions").insert(rows);
  if (error) return { error: error.message, imported: 0 };

  revalidatePath("/my-workspace");
  return { error: null, imported: rows.length };
}

export async function updateDocumentExtractionField(formData: FormData): Promise<{ error: string | null }> {
  const id = (formData.get("id") as string) || "";
  const fieldIndex = Number(formData.get("fieldIndex"));
  const value = (formData.get("value") as string) || "";
  if (!id || !Number.isInteger(fieldIndex) || fieldIndex < 0) return { error: null };

  const { supabase, me } = await requireMyWorkspaceUser();

  const { data: row, error: fetchError } = await supabase
    .from("document_extractions")
    .select("fields")
    .eq("id", id)
    .eq("owner", me.name)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!row) return { error: "That entry could not be found." };

  // Read-modify-write on the whole jsonb array, not a targeted jsonb_set --
  // simpler, and fine given this only ever runs for one person at a time,
  // but two near-simultaneous edits to two different fields on the same
  // document could race (the later write's read predates the earlier
  // write's save, clobbering it).
  const fields = Array.isArray(row.fields) ? [...row.fields] : [];
  if (fieldIndex >= fields.length) return { error: "That field no longer exists." };
  fields[fieldIndex] = { ...fields[fieldIndex], value };

  const { error } = await supabase.from("document_extractions").update({ fields }).eq("id", id).eq("owner", me.name);
  if (error) return { error: error.message };

  revalidatePath("/my-workspace");
  return { error: null };
}

/* reviewed_at/encoded_at are set the FIRST time status reaches
   approved/encoded and never overwritten after that -- so re-approving
   something after bouncing it back to pending_review doesn't erase
   when it was originally reviewed. */
export async function setDocumentExtractionStatus(formData: FormData): Promise<{ error: string | null }> {
  const id = (formData.get("id") as string) || "";
  const status = (formData.get("status") as string) || "";
  const rejectionReason = ((formData.get("rejectionReason") as string) || "").trim();
  if (!id || !VALID_STATUSES.includes(status as DocumentExtractionStatus)) return { error: null };

  const { supabase, me } = await requireMyWorkspaceUser();

  const { data: row, error: fetchError } = await supabase
    .from("document_extractions")
    .select("reviewed_at, encoded_at")
    .eq("id", id)
    .eq("owner", me.name)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!row) return { error: "That entry could not be found." };

  const patch: Record<string, unknown> = { status, rejection_reason: status === "rejected" ? rejectionReason || null : null };
  if (status === "approved" && !row.reviewed_at) patch.reviewed_at = new Date().toISOString();
  if (status === "encoded" && !row.encoded_at) patch.encoded_at = new Date().toISOString();

  const { error } = await supabase.from("document_extractions").update(patch).eq("id", id).eq("owner", me.name);
  if (error) return { error: error.message };

  revalidatePath("/my-workspace");
  return { error: null };
}

export async function removeDocumentExtraction(formData: FormData) {
  const id = (formData.get("id") as string) || "";
  if (!id) return;

  const { supabase, me } = await requireMyWorkspaceUser();

  const { error } = await supabase.from("document_extractions").delete().eq("id", id).eq("owner", me.name);
  if (error) throw new Error(error.message);

  revalidatePath("/my-workspace");
}
