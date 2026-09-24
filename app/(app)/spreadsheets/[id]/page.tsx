import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { SpreadsheetView } from "@/components/spreadsheet-view";
import { loadSheetContent, loadSpreadsheet, loadSpreadsheetContext } from "@/lib/spreadsheet-data";
import {
  createSpreadsheetSheet,
  deleteSpreadsheetSheet,
  fetchSheetContent,
  renameSpreadsheetSheet,
  reorderSpreadsheetSheets,
  saveSheetOps,
} from "../actions";

export default async function SpreadsheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await params;
  const { sheet } = await searchParams;

  const context = await loadSpreadsheetContext();
  if (!context) redirect("/login");

  const loaded = await loadSpreadsheet(id);
  if (!loaded) notFound();
  const { spreadsheet, sheets } = loaded;

  // ?sheet= keeps a refresh on the same tab; anything unknown falls back to the first sheet.
  const sheetFromUrl = sheets.some((s) => s.id === sheet);
  const initialSheetId = sheets.find((s) => s.id === sheet)?.id ?? sheets[0]?.id ?? null;
  const initialContent = initialSheetId ? await loadSheetContent(initialSheetId) : null;

  return (
    <div>
      <PageHeader title={spreadsheet.title} />
      <PageBody gap={6}>
        <Link
          href="/spreadsheets"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ring/30 bg-ring/10 px-3 py-1 text-sm font-medium text-ring shadow-sm transition-colors hover:bg-ring/20"
        >
          <ArrowLeft className="h-4 w-4" />
          All spreadsheets
        </Link>
        <SpreadsheetView
          key={spreadsheet.id}
          spreadsheet={spreadsheet}
          sheets={sheets}
          initialSheetId={initialSheetId}
          initialContent={initialContent}
          sheetFromUrl={sheetFromUrl}
          me={context.owner}
          demo={context.demo}
          createSheet={createSpreadsheetSheet}
          renameSheet={renameSpreadsheetSheet}
          reorderSheets={reorderSpreadsheetSheets}
          deleteSheet={deleteSpreadsheetSheet}
          saveSheetOps={saveSheetOps}
          fetchSheetContent={fetchSheetContent}
        />
      </PageBody>
    </div>
  );
}
