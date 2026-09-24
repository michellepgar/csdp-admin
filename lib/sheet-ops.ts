import { addColumn, addRow, coerceCell, newCellId, normalizeFillColor, normalizeFormat, removeColumn, removeRow, renameColumn, setCellStyles, setColumnType, setFills, setFormats, normalizeSides, CELL_ALIGNS, CELL_FONTS, CELL_SIZES, MAX_COLUMNS, MAX_ROWS } from "./workspace.ts";
import type { CellFormat, CellValue, ColumnType, FormatPatch, TableContent } from "./workspace.ts";

/* A table edit described as a small operation instead of a whole new table.
   The shared Spreadsheets page sends these to the server, which applies them
   to the LATEST saved copy -- so two people editing different cells at the
   same time both keep their changes. Every operation names rows and columns
   by id and is safe to apply twice (adding a row that already exists does
   nothing), so a client can always replay its unsaved edits on top of a
   fresher copy. */

export type CellRef = [rowId: string, columnId: string];
export type SheetOp =
  | { t: "set"; cells: [string, string, CellValue][] }
  | { t: "fill"; cells: CellRef[]; color: string | null }
  | { t: "format"; cells: CellRef[]; patch: FormatPatch }
  | { t: "style"; cells: [string, string, string | null, CellFormat | null][] }
  | { t: "addRow"; id: string }
  | { t: "removeRow"; id: string }
  | { t: "addCol"; id: string; name?: string }
  | { t: "removeCol"; id: string }
  | { t: "renameCol"; id: string; name: string }
  | { t: "colType"; id: string; type: ColumnType; options?: string[] }
  | { t: "header"; on: boolean };

const MAX_OPS = 2000;
const MAX_CELLS_PER_OP = 30_000;
const ID = /^[\w-]{1,64}$/;
const COLUMN_TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "dropdown"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);

const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v) && !RESERVED.has(v) && !(v in Object.prototype);
const isValue = (v: unknown): v is CellValue => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function readRefs(raw: unknown): CellRef[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_CELLS_PER_OP) return null;
  const refs: CellRef[] = [];
  for (const ref of raw) {
    if (!Array.isArray(ref) || !isId(ref[0]) || !isId(ref[1])) return null;
    refs.push([ref[0], ref[1]]);
  }
  return refs;
}

function readPatch(raw: unknown): FormatPatch | null {
  if (!isObject(raw)) return null;
  const patch: FormatPatch = {};
  for (const flag of ["b", "i", "u"] as const) if (typeof raw[flag] === "boolean") patch[flag] = raw[flag] as boolean;
  if (raw.size === null || CELL_SIZES.includes(raw.size as never)) patch.size = raw.size as FormatPatch["size"];
  if (raw.font === null || CELL_FONTS.includes(raw.font as never)) patch.font = raw.font as FormatPatch["font"];
  if (raw.align === null || CELL_ALIGNS.includes(raw.align as never)) patch.align = raw.align as FormatPatch["align"];
  if (raw.color === null) patch.color = null;
  else if (normalizeFillColor(raw.color)) patch.color = normalizeFillColor(raw.color);
  if (typeof raw.borderOn === "string") patch.borderOn = normalizeSides(raw.borderOn);
  if (typeof raw.borderOff === "string") patch.borderOff = normalizeSides(raw.borderOff);
  return patch;
}

/** Checks a list of operations sent by a browser. Returns null if any part is malformed. */
export function readSheetOps(raw: unknown): SheetOp[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_OPS) return null;
  const ops: SheetOp[] = [];
  for (const op of raw) {
    if (!isObject(op)) return null;
    switch (op.t) {
      case "set": {
        if (!Array.isArray(op.cells) || op.cells.length > MAX_CELLS_PER_OP) return null;
        const cells: [string, string, CellValue][] = [];
        for (const c of op.cells) {
          if (!Array.isArray(c) || !isId(c[0]) || !isId(c[1]) || !isValue(c[2])) return null;
          cells.push([c[0], c[1], typeof c[2] === "string" ? c[2].slice(0, 5000) : c[2]]);
        }
        ops.push({ t: "set", cells });
        break;
      }
      case "fill": {
        const cells = readRefs(op.cells);
        if (!cells || (op.color !== null && !normalizeFillColor(op.color))) return null;
        ops.push({ t: "fill", cells, color: op.color === null ? null : normalizeFillColor(op.color) });
        break;
      }
      case "format": {
        const cells = readRefs(op.cells);
        const patch = readPatch(op.patch);
        if (!cells || !patch) return null;
        ops.push({ t: "format", cells, patch });
        break;
      }
      case "style": {
        if (!Array.isArray(op.cells) || op.cells.length > MAX_CELLS_PER_OP) return null;
        const cells: [string, string, string | null, CellFormat | null][] = [];
        for (const c of op.cells) {
          if (!Array.isArray(c) || !isId(c[0]) || !isId(c[1])) return null;
          cells.push([c[0], c[1], normalizeFillColor(c[2]), normalizeFormat(c[3])]);
        }
        ops.push({ t: "style", cells });
        break;
      }
      case "addRow":
      case "removeRow":
      case "removeCol":
        if (!isId(op.id)) return null;
        ops.push({ t: op.t, id: op.id });
        break;
      case "addCol":
        if (!isId(op.id) || (op.name !== undefined && typeof op.name !== "string")) return null;
        ops.push({ t: "addCol", id: op.id, ...(typeof op.name === "string" ? { name: op.name.slice(0, 60) } : {}) });
        break;
      case "renameCol":
        if (!isId(op.id) || typeof op.name !== "string") return null;
        ops.push({ t: "renameCol", id: op.id, name: op.name.slice(0, 60) });
        break;
      case "colType": {
        if (!isId(op.id) || !COLUMN_TYPES.includes(op.type as ColumnType)) return null;
        const options = Array.isArray(op.options) ? op.options.filter((o): o is string => typeof o === "string").map((o) => o.slice(0, 60)).slice(0, 100) : undefined;
        ops.push({ t: "colType", id: op.id, type: op.type as ColumnType, ...(options ? { options } : {}) });
        break;
      }
      case "header":
        if (typeof op.on !== "boolean") return null;
        ops.push({ t: "header", on: op.on });
        break;
      default:
        return null;
    }
  }
  return ops;
}

/* Sets each listed cell to its own value (coerced to its column's type). Rows that don't change keep their identity. */
function setValues(content: TableContent, cells: [string, string, CellValue][]): TableContent {
  const byRow = new Map<string, [string, CellValue][]>();
  for (const [rowId, columnId, value] of cells) {
    const list = byRow.get(rowId);
    if (list) list.push([columnId, value]);
    else byRow.set(rowId, [[columnId, value]]);
  }
  const columns = new Map(content.columns.map((c) => [c.id, c]));
  let changed = false;
  const rows = content.rows.map((row) => {
    const targets = byRow.get(row.id);
    if (!targets) return row;
    let next: Record<string, CellValue> | null = null;
    for (const [columnId, value] of targets) {
      const column = columns.get(columnId);
      if (!column) continue;
      const coerced = coerceCell(value, column.type, column.options);
      const current = Object.hasOwn(row.cells, columnId) ? row.cells[columnId] : null;
      if (coerced === current) continue;
      next ??= { ...row.cells };
      next[columnId] = coerced;
    }
    if (!next) return row;
    changed = true;
    return { ...row, cells: next };
  });
  return changed ? { ...content, rows } : content;
}

export function applySheetOp(content: TableContent, op: SheetOp): TableContent {
  switch (op.t) {
    case "set":
      return setValues(content, op.cells);
    case "fill":
      return setFills(content, op.cells, op.color);
    case "format":
      return setFormats(content, op.cells, op.patch);
    case "style":
      return setCellStyles(content, op.cells);
    case "addRow":
      return content.rows.length >= MAX_ROWS ? content : addRow(content, op.id);
    case "removeRow":
      return removeRow(content, op.id);
    case "addCol":
      return content.columns.length >= MAX_COLUMNS ? content : addColumn(content, op.name, "text", op.id);
    case "removeCol":
      return removeColumn(content, op.id);
    case "renameCol":
      return renameColumn(content, op.id, op.name);
    case "header": {
      if (op.on) return content.header ? content : { ...content, header: true };
      if (!content.header) return content;
      const { header: _h, ...rest } = content;
      void _h;
      return rest;
    }
    case "colType":
      return content.columns.some((c) => c.id === op.id) ? setColumnType(content, op.id, op.type, op.options) : content;
  }
}

export function applySheetOps(content: TableContent, ops: SheetOp[]): TableContent {
  let next = content;
  for (const op of ops) next = applySheetOp(next, op);
  return next;
}

/** The operations that paste a grid with its top-left at (startRow, startCol),
 *  adding rows and columns as needed, plus the ids of the pasted rows and
 *  columns (for applying the pasted styling afterwards). */
export function pasteOps(content: TableContent, startRow: number, startCol: number, grid: string[][], newId: () => string = newCellId): { ops: SheetOp[]; rowIds: string[]; columnIds: string[] } {
  let width = 0;
  for (const line of grid) if (line.length > width) width = line.length;
  const ops: SheetOp[] = [];
  const columnIds = content.columns.map((c) => c.id);
  const rowIds = content.rows.map((r) => r.id);
  const neededCols = Math.min(MAX_COLUMNS, startCol + width);
  while (columnIds.length < neededCols) {
    const id = newId();
    ops.push({ t: "addCol", id });
    columnIds.push(id);
  }
  const neededRows = Math.min(MAX_ROWS, startRow + grid.length);
  while (rowIds.length < neededRows) {
    const id = newId();
    ops.push({ t: "addRow", id });
    rowIds.push(id);
  }
  const cells: [string, string, CellValue][] = [];
  grid.forEach((line, r) => {
    const rowId = rowIds[startRow + r];
    if (!rowId) return;
    line.forEach((value, c) => {
      const columnId = columnIds[startCol + c];
      if (columnId) cells.push([rowId, columnId, value]);
    });
  });
  if (cells.length > 0) ops.push({ t: "set", cells });
  return { ops, rowIds: rowIds.slice(startRow, startRow + grid.length), columnIds: columnIds.slice(startCol, startCol + width) };
}
