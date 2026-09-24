import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { WorkspaceList } from "@/components/workspace-list";
import { loadWorkspaceContext, loadWorkbooks } from "@/lib/workspace-data";
import { createWorkbook, renameWorkbook, setWorkbookTags, deleteWorkbook } from "./actions";

export default async function MyWorkspacePage() {
  const context = await loadWorkspaceContext();
  if (!context) redirect("/login");

  const workbooks = await loadWorkbooks();

  return (
    <div>
      <PageHeader title="My Workspace" />
      <PageBody>
        <WorkspaceList
          workbooks={workbooks}
          createWorkbook={createWorkbook}
          renameWorkbook={renameWorkbook}
          setWorkbookTags={setWorkbookTags}
          deleteWorkbook={deleteWorkbook}
        />
      </PageBody>
    </div>
  );
}
