import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { WorkspaceList } from "@/components/workspace-list";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { PrivateNotesSection } from "@/components/private-notes-section";
import { RememberWorkspacePlace } from "@/components/remember-workspace-place";
import { hasUnreadSharedNote, loadWorkspaceContext, loadWorkbooks } from "@/lib/workspace-data";
import { PRIVATE_NOTES_PLACE } from "@/lib/workspace-last-place";
import { createWorkbook, renameWorkbook, setWorkbookTags, deleteWorkbook } from "./actions";

/* My Workspace: your workbooks, and (the Private Notes tab, ?tab=notes)
   every private note you wrote or that was shared with you. */
export default async function MyWorkspacePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; highlightNote?: string }> }) {
  const { tab, q, highlightNote } = await searchParams;
  const context = await loadWorkspaceContext();
  if (!context) redirect("/login");

  const showNotes = tab === "notes";
  const [workbooks, notesAlert] = await Promise.all([showNotes ? Promise.resolve([]) : loadWorkbooks(), hasUnreadSharedNote(context)]);

  return (
    <div>
      <PageHeader title="My Workspace" />
      <PageBody>
        <WorkspaceTabs active={showNotes ? "notes" : "workbooks"} notesAlert={notesAlert && !showNotes} />
        {showNotes ? (
          <>
            <RememberWorkspacePlace place={PRIVATE_NOTES_PLACE} />
            <PrivateNotesSection q={q} highlightNote={highlightNote} />
          </>
        ) : (
          <WorkspaceList
            workbooks={workbooks}
            createWorkbook={createWorkbook}
            renameWorkbook={renameWorkbook}
            setWorkbookTags={setWorkbookTags}
            deleteWorkbook={deleteWorkbook}
          />
        )}
      </PageBody>
    </div>
  );
}
