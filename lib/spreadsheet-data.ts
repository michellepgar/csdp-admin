import { createClient } from "@/lib/supabase/server";
import { getDemoState } from "@/lib/demo-session";
import { loadWorkspaceContext } from "@/lib/workspace-data";
import { readGrid } from "@/lib/spreadsheets";
import type { SheetContent, Spreadsheet, SpreadsheetSheet } from "@/lib/spreadsheets";

/* Server-only read side of the shared Spreadsheets page. Every team member
   sees every spreadsheet (the database's row-level security allows exactly
   that). Demo mode reads the demo visitor's copy from the demo cookies. */

type SpreadsheetRow = { id: string; title: string; tags: string[] | null; created_by: string; created_at: string; updated_at: string; updated_by: string | null };
type SheetRow = { id: string; spreadsheet_id: string; name: string; sort_order: number; version: number; updated_at: string; updated_by: string | null };

const toSpreadsheet = (row: SpreadsheetRow): Spreadsheet => ({
  id: row.id,
  title: row.title,
  tags: row.tags ?? [],
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const toSheet = (row: SheetRow): SpreadsheetSheet => ({
  id: row.id,
  spreadsheetId: row.spreadsheet_id,
  name: row.name,
  sortOrder: row.sort_order,
  version: Number(row.version),
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

/** Who is signed in (null: not a team member). Same identity My Workspace uses. */
export const loadSpreadsheetContext = loadWorkspaceContext;

export async function loadSpreadsheets(): Promise<Spreadsheet[]> {
  const context = await loadSpreadsheetContext();
  if (!context) return [];
  if (context.demo) {
    const list = (await getDemoState()).spreadsheets?.spreadsheets ?? [];
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spreadsheets")
    .select("id, title, tags, created_by, created_at, updated_at, updated_by")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SpreadsheetRow[]).map(toSpreadsheet);
}

export async function loadSpreadsheet(id: string): Promise<{ spreadsheet: Spreadsheet; sheets: SpreadsheetSheet[] } | null> {
  const context = await loadSpreadsheetContext();
  if (!context) return null;
  if (context.demo) {
    const data = (await getDemoState()).spreadsheets;
    const spreadsheet = data?.spreadsheets.find((s) => s.id === id);
    if (!data || !spreadsheet) return null;
    return { spreadsheet, sheets: data.sheets.filter((s) => s.spreadsheetId === id).sort((a, b) => a.sortOrder - b.sortOrder) };
  }
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("spreadsheets").select("id, title, tags, created_by, created_at, updated_at, updated_by").eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a uuid: just "not found"
    throw new Error(error.message);
  }
  if (!row) return null;
  const { data: sheetRows, error: sheetError } = await supabase
    .from("spreadsheet_sheets")
    .select("id, spreadsheet_id, name, sort_order, version, updated_at, updated_by")
    .eq("spreadsheet_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (sheetError) throw new Error(sheetError.message);
  return { spreadsheet: toSpreadsheet(row as SpreadsheetRow), sheets: (sheetRows as SheetRow[]).map(toSheet) };
}

export async function loadSheetContent(sheetId: string): Promise<SheetContent | null> {
  const context = await loadSpreadsheetContext();
  if (!context) return null;
  if (context.demo) return (await getDemoState()).spreadsheets?.contents[sheetId] ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("spreadsheet_sheet_content").select("content, version").eq("sheet_id", sheetId).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return { content: readGrid(data.content), version: Number(data.version) };
}
