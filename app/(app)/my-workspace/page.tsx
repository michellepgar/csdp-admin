import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { isMyWorkspaceUser } from "@/lib/my-workspace-access";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { DocumentReviewList } from "@/components/document-review-list";
import type { DocumentExtraction } from "@/lib/document-extractions";
import {
  importDocumentExtractions,
  updateDocumentExtractionField,
  setDocumentExtractionStatus,
  removeDocumentExtraction,
} from "./actions";

export default async function MyWorkspacePage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");
  // Covers demo mode too: the demo account's email
  // (jane@demo.csdp-tracker.local, see lib/demo-app-state.ts) can
  // never match isMyWorkspaceUser(), so no separate isDemoMode()
  // check is needed here.
  if (!isMyWorkspaceUser(user.email)) redirect("/overview");

  const supabase = await createClient();
  const { data: vaRow } = await supabase.from("vas").select("name").ilike("email", user.email).maybeSingle();
  if (!vaRow) redirect("/not-on-team");

  const { data: rows } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("owner", vaRow.name)
    .order("created_at", { ascending: false });

  const entries: DocumentExtraction[] = (rows || []).map((row) => ({
    id: row.id,
    documentName: row.document_name,
    documentType: row.document_type,
    school: row.school,
    summary: row.summary,
    fields: row.fields || [],
    flags: row.flags || [],
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }));

  return (
    <div>
      <PageHeader title="My Workspace" />
      <PageBody>
        <DocumentReviewList
          entries={entries}
          importDocumentExtractions={importDocumentExtractions}
          updateDocumentExtractionField={updateDocumentExtractionField}
          setDocumentExtractionStatus={setDocumentExtractionStatus}
          removeDocumentExtraction={removeDocumentExtraction}
        />
      </PageBody>
    </div>
  );
}
