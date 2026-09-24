import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { WorkspaceList } from "@/components/workspace-list";
import { loadSpreadsheetContext, loadSpreadsheets } from "@/lib/spreadsheet-data";
import { createSpreadsheet, renameSpreadsheet, setSpreadsheetTags, deleteSpreadsheet } from "./actions";

export default async function SpreadsheetsPage() {
  const context = await loadSpreadsheetContext();
  if (!context) redirect("/login");

  const spreadsheets = await loadSpreadsheets();

  return (
    <div>
      <PageHeader title="Spreadsheets" />
      <PageBody>
        <WorkspaceList
          wording={{ basePath: "/spreadsheets", noun: "spreadsheet", when: "Edited", sortLabel: "Last edited" }}
          workbooks={spreadsheets.map((s) => ({ id: s.id, title: s.title, tags: s.tags, createdAt: s.createdAt, updatedAt: s.updatedAt, updatedBy: s.updatedBy }))}
          createWorkbook={createSpreadsheet}
          renameWorkbook={renameSpreadsheet}
          setWorkbookTags={setSpreadsheetTags}
          deleteWorkbook={deleteSpreadsheet}
        />
      </PageBody>
    </div>
  );
}
