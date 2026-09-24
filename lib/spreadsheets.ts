import { columnName, newCellId, validateBlockContent } from "./workspace.ts";
import type { TableContent } from "./workspace.ts";

/* The shared Spreadsheets page (under Resources): spreadsheets anyone on the
   team can open, edit, add and delete. Each spreadsheet has sheets (tabs),
   and each sheet is one full grid -- the same table model My Workspace uses
   (lib/workspace.ts), edited through the operations in lib/sheet-ops.ts. */

export type Spreadsheet = { id: string; title: string; tags: string[]; createdBy: string; createdAt: string; updatedAt: string; updatedBy: string | null };
export type SpreadsheetSheet = { id: string; spreadsheetId: string; name: string; sortOrder: number; version: number; updatedAt: string; updatedBy: string | null };
export type SheetContent = { content: TableContent; version: number };
/** Demo mode keeps all of this in the demo cookie. */
export type SpreadsheetData = { spreadsheets: Spreadsheet[]; sheets: SpreadsheetSheet[]; contents: Record<string, SheetContent> };

export const BLANK_COLUMNS = 8;
export const BLANK_ROWS = 20;

/** A new sheet: an empty grid of columns A-H and 20 rows, like a fresh spreadsheet tab. */
export function blankGrid(newId: () => string = newCellId): TableContent {
  return {
    columns: Array.from({ length: BLANK_COLUMNS }, (_, i) => ({ id: newId(), name: columnName(i), type: "text" as const })),
    rows: Array.from({ length: BLANK_ROWS }, () => ({ id: newId(), cells: {} })),
  };
}

/* A saved grid, checked before use: the database accepts any JSON, so a grid
   written some other way must not crash the page or the save. Anything that
   can't be read at all becomes a blank grid. (Tables hold no HTML, so no
   sanitizer is needed.) */
export function readGrid(raw: unknown): TableContent {
  return (validateBlockContent("table", raw, (html) => html) as TableContent | null) ?? blankGrid();
}
