import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { WorkspaceCanvas } from "@/components/workspace-canvas";
import { loadWorkbook, loadWorkspaceContext } from "@/lib/workspace-data";
import { touchWorkbook, setWorkbookBackground, createSheet, renameSheet, reorderSheets, deleteSheet, createBlock, updateBlockContent, updateBlockRect, deleteBlock } from "../actions";

export default async function WorkbookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await params;
  const { sheet } = await searchParams;

  const context = await loadWorkspaceContext();
  if (!context) redirect("/login");

  const loaded = await loadWorkbook(id);
  if (!loaded) redirect("/my-workspace"); // deleted (or a bad link): show the list
  const { workbook, sheets, blocks } = loaded;

  // ?sheet= keeps a refresh on the same tab; anything unknown falls back to the first sheet.
  const sheetFromUrl = sheets.some((s) => s.id === sheet);
  const initialSheetId = sheets.find((s) => s.id === sheet)?.id ?? sheets[0]?.id ?? null;

  return (
    <div>
      <PageHeader title={workbook.title} />
      <PageBody gap={6}>
        <Link
          href="/my-workspace"
          className="inline-flex items-center gap-1.5 rounded-full border border-ring/30 bg-ring/10 px-3 py-1 text-sm font-medium text-ring shadow-sm transition-colors hover:bg-ring/20"
        >
          <ArrowLeft className="h-4 w-4" />
          All workbooks
        </Link>
        <WorkspaceCanvas
          key={workbook.id}
          workbook={workbook}
          sheets={sheets}
          blocks={blocks}
          initialSheetId={initialSheetId}
          sheetFromUrl={sheetFromUrl}
          touchWorkbook={touchWorkbook}
          setWorkbookBackground={setWorkbookBackground}
          createSheet={createSheet}
          renameSheet={renameSheet}
          reorderSheets={reorderSheets}
          deleteSheet={deleteSheet}
          createBlock={createBlock}
          updateBlockContent={updateBlockContent}
          updateBlockRect={updateBlockRect}
          deleteBlock={deleteBlock}
        />
      </PageBody>
    </div>
  );
}
