import { addColumn, addRow, clampWidth, coerceCell, newCellId, normalizeFillColor, normalizeFormat, removeColumn, removeRow, renameColumn, setCellStyles, setColumnType, setFills, setFormats, normalizeFreeze, normalizeSides, CELL_ALIGNS, CELL_FONTS, CELL_SIZES, MAX_COLUMNS, MAX_ROWS } from "./workspace.ts";
import type { CellFormat, CellValue, ColumnType, FormatPatch, Merge, TableColumn, TableContent, TableRow } from "./workspace.ts";

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
  | { t: "header"; on: boolean }
  | { t: "freeze"; rows: number; cols: number }
  /* Put back a deleted row or column where it was (used by undo). */
  | { t: "insertRow"; id: string; index: number; cells: Record<string, CellValue> }
  | { t: "insertCol"; id: string; index: number; name: string; type: ColumnType; options?: string[]; width?: number; cells: Record<string, CellValue> }
  | { t: "colWidth"; id: string; width: number | null }
  | { t: "merge"; r1: string; c1: string; r2: string; c2: string }
  | { t: "unmerge"; r1: string; c1: string };

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
      case "insertRow":
      case "insertCol": {
        if (!isId(op.id) || typeof op.index !== "number" || !Number.isInteger(op.index) || op.index < 0 || !isObject(op.cells)) return null;
        const entries = Object.entries(op.cells);
        if (entries.length > MAX_CELLS_PER_OP) return null;
        const cells: Record<string, CellValue> = {};
        for (const [key, value] of entries) {
          if (!isId(key) || !isValue(value)) return null;
          cells[key] = typeof value === "string" ? value.slice(0, 5000) : value;
        }
        if (op.t === "insertRow") {
          ops.push({ t: "insertRow", id: op.id, index: op.index, cells });
          break;
        }
        if (typeof op.name !== "string" || !COLUMN_TYPES.includes(op.type as ColumnType)) return null;
        const options = Array.isArray(op.options) ? op.options.filter((o): o is string => typeof o === "string").map((o) => o.slice(0, 60)).slice(0, 100) : undefined;
        const width = typeof op.width === "number" && Number.isFinite(op.width) ? clampWidth(op.width) : undefined;
        ops.push({ t: "insertCol", id: op.id, index: op.index, name: op.name.slice(0, 60) || "Column", type: op.type as ColumnType, ...(options ? { options } : {}), ...(width ? { width } : {}), cells });
        break;
      }
      case "colWidth":
        if (!isId(op.id) || !(op.width === null || (typeof op.width === "number" && Number.isFinite(op.width)))) return null;
        ops.push({ t: "colWidth", id: op.id, width: op.width === null ? null : clampWidth(op.width as number) });
        break;
      case "merge":
        if (!isId(op.r1) || !isId(op.c1) || !isId(op.r2) || !isId(op.c2)) return null;
        ops.push({ t: "merge", r1: op.r1, c1: op.c1, r2: op.r2, c2: op.c2 });
        break;
      case "unmerge":
        if (!isId(op.r1) || !isId(op.c1)) return null;
        ops.push({ t: "unmerge", r1: op.r1, c1: op.c1 });
        break;
      case "freeze": {
        if (typeof op.rows !== "number" || typeof op.cols !== "number") return null;
        const freeze = normalizeFreeze({ rows: op.rows, cols: op.cols }) ?? { rows: 0, cols: 0 };
        ops.push({ t: "freeze", rows: freeze.rows, cols: freeze.cols });
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
    case "freeze": {
      const { freeze: _f, ...rest } = content;
      void _f;
      const freeze = normalizeFreeze(op);
      return freeze ? { ...rest, freeze } : rest;
    }
    case "header": {
      if (op.on) return content.header ? content : { ...content, header: true };
      if (!content.header) return content;
      const { header: _h, ...rest } = content;
      void _h;
      return rest;
    }
    case "colType":
      return content.columns.some((c) => c.id === op.id) ? setColumnType(content, op.id, op.type, op.options) : content;
    case "insertRow": {
      if (content.rows.length >= MAX_ROWS || content.rows.some((r) => r.id === op.id)) return content;
      const known = new Set(content.columns.map((c) => c.id));
      const cells: Record<string, CellValue> = {};
      for (const [columnId, value] of Object.entries(op.cells)) if (known.has(columnId)) cells[columnId] = value;
      const rows = [...content.rows];
      rows.splice(Math.min(op.index, rows.length), 0, { id: op.id, cells });
      return { ...content, rows };
    }
    case "colWidth": {
      if (!content.columns.some((c) => c.id === op.id)) return content;
      const columns = content.columns.map((c) => {
        if (c.id !== op.id) return c;
        const { width: _w, ...rest } = c;
        void _w;
        return op.width === null ? rest : { ...rest, width: clampWidth(op.width) };
      });
      return { ...content, columns };
    }
    case "merge": {
      const box = mergeBox(content, op);
      if (!box || (box.top === box.bottom && box.left === box.right)) return content;
      const kept = (content.merges ?? []).filter((m) => {
        const other = mergeBox(content, m);
        return other && !overlaps(box, other);
      });
      return { ...content, merges: [...kept, { r1: op.r1, c1: op.c1, r2: op.r2, c2: op.c2 }] };
    }
    case "unmerge": {
      const merges = (content.merges ?? []).filter((m) => !(m.r1 === op.r1 && m.c1 === op.c1));
      if (merges.length === (content.merges ?? []).length) return content;
      const { merges: _m, ...rest } = content;
      void _m;
      return merges.length > 0 ? { ...rest, merges } : rest;
    }
    case "insertCol": {
      if (content.columns.length >= MAX_COLUMNS || content.columns.some((c) => c.id === op.id)) return content;
      const column: TableColumn = { id: op.id, name: op.name, type: op.type, ...(op.type === "dropdown" ? { options: op.options ?? [] } : {}), ...(op.width ? { width: op.width } : {}) };
      const columns = [...content.columns];
      columns.splice(Math.min(op.index, columns.length), 0, column);
      const rows = content.rows.map((r) => (Object.hasOwn(op.cells, r.id) ? { ...r, cells: { ...r.cells, [op.id]: op.cells[r.id] } } : r));
      return { ...content, columns, rows };
    }
  }
}

type Box = { top: number; bottom: number; left: number; right: number };

/** Where a merge sits right now (row and column positions), or null if a row or column in it is gone. */
export function mergeBox(content: TableContent, m: Merge): Box | null {
  const r1 = content.rows.findIndex((r) => r.id === m.r1);
  const r2 = content.rows.findIndex((r) => r.id === m.r2);
  const c1 = content.columns.findIndex((c) => c.id === m.c1);
  const c2 = content.columns.findIndex((c) => c.id === m.c2);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0 || r2 < r1 || c2 < c1) return null;
  return { top: r1, bottom: r2, left: c1, right: c2 };
}

const overlaps = (a: Box, b: Box) => a.top <= b.bottom && b.top <= a.bottom && a.left <= b.right && b.left <= a.right;

/* ---------- undo ---------- */

const cellKey = (rowId: string, columnId: string) => `${rowId}|${columnId}`;
const rawOf = (row: TableRow, columnId: string): CellValue => (Object.hasOwn(row.cells, columnId) ? row.cells[columnId] : null);

/* The exact highlight and format each listed cell has now, as a "style" operation. */
function styleNow(content: TableContent, cells: [string, string][]): SheetOp[] {
  if (cells.length === 0) return [];
  return [{ t: "style", cells: cells.map(([r, c]) => [r, c, content.fills?.[cellKey(r, c)] ?? null, content.formats?.[cellKey(r, c)] ?? null]) }];
}

/* The operations that undo one operation, given the table as it was just before it. */
function invertOne(content: TableContent, op: SheetOp): SheetOp[] {
  const rows = new Map(content.rows.map((r) => [r.id, r]));
  const columns = new Map(content.columns.map((c) => [c.id, c]));
  const exists = (r: string, c: string) => rows.has(r) && columns.has(c);
  switch (op.t) {
    case "set": {
      const cells = op.cells.filter(([r, c]) => exists(r, c)).map(([r, c]) => [r, c, rawOf(rows.get(r)!, c)] as [string, string, CellValue]);
      return cells.length > 0 ? [{ t: "set", cells }] : [];
    }
    case "fill":
    case "format":
      return styleNow(content, op.cells.filter(([r, c]) => exists(r, c)));
    case "style":
      return styleNow(content, op.cells.filter(([r, c]) => exists(r, c)).map(([r, c]) => [r, c] as [string, string]));
    case "addRow":
      return rows.has(op.id) || content.rows.length >= MAX_ROWS ? [] : [{ t: "removeRow", id: op.id }];
    case "insertRow":
      return rows.has(op.id) || content.rows.length >= MAX_ROWS ? [] : [{ t: "removeRow", id: op.id }];
    case "removeRow": {
      const row = rows.get(op.id);
      if (!row) return [];
      const styled = content.columns.filter((c) => content.fills?.[cellKey(row.id, c.id)] || content.formats?.[cellKey(row.id, c.id)]).map((c) => [row.id, c.id] as [string, string]);
      return [{ t: "insertRow", id: row.id, index: content.rows.indexOf(row), cells: { ...row.cells } }, ...styleNow(content, styled)];
    }
    case "addCol":
    case "insertCol":
      return columns.has(op.id) || content.columns.length >= MAX_COLUMNS ? [] : [{ t: "removeCol", id: op.id }];
    case "removeCol": {
      const column = columns.get(op.id);
      if (!column || content.columns.length <= 1) return [];
      const cells: Record<string, CellValue> = {};
      for (const row of content.rows) if (Object.hasOwn(row.cells, column.id)) cells[row.id] = row.cells[column.id];
      const styled = content.rows.filter((r) => content.fills?.[cellKey(r.id, column.id)] || content.formats?.[cellKey(r.id, column.id)]).map((r) => [r.id, column.id] as [string, string]);
      return [
        { t: "insertCol", id: column.id, index: content.columns.indexOf(column), name: column.name, type: column.type, ...(column.options ? { options: column.options } : {}), ...(column.width ? { width: column.width } : {}), cells },
        ...styleNow(content, styled),
      ];
    }
    case "renameCol": {
      const column = columns.get(op.id);
      return column && column.name !== op.name ? [{ t: "renameCol", id: column.id, name: column.name }] : [];
    }
    case "colType": {
      const column = columns.get(op.id);
      if (!column) return [];
      return [
        { t: "colType", id: column.id, type: column.type, ...(column.options ? { options: column.options } : {}) },
        { t: "set", cells: content.rows.map((r) => [r.id, column.id, rawOf(r, column.id)] as [string, string, CellValue]) },
      ];
    }
    case "colWidth": {
      const column = columns.get(op.id);
      return column ? [{ t: "colWidth", id: column.id, width: column.width ?? null }] : [];
    }
    case "merge": {
      const box = mergeBox(content, op);
      if (!box || (box.top === box.bottom && box.left === box.right)) return [];
      // Merging drops any merge it overlaps; undo puts those back.
      const replaced = (content.merges ?? []).filter((m) => {
        const other = mergeBox(content, m);
        return other && overlaps(box, other);
      });
      return [{ t: "unmerge", r1: op.r1, c1: op.c1 }, ...replaced.map((m) => ({ t: "merge" as const, ...m }))];
    }
    case "unmerge": {
      const m = (content.merges ?? []).find((x) => x.r1 === op.r1 && x.c1 === op.c1);
      return m ? [{ t: "merge", ...m }] : [];
    }
    case "header":
      return [{ t: "header", on: !!content.header }];
    case "freeze":
      return [{ t: "freeze", rows: content.freeze?.rows ?? 0, cols: content.freeze?.cols ?? 0 }];
  }
}

/** The operations that undo `ops` (applied to `content`): each step's reverse, last step first. */
export function invertSheetOps(content: TableContent, ops: SheetOp[]): SheetOp[] {
  const steps: SheetOp[][] = [];
  let state = content;
  for (const op of ops) {
    steps.push(invertOne(state, op));
    state = applySheetOp(state, op);
  }
  return steps.reverse().flat();
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
