export type BlockKind = "table" | "note" | "reminder";
export type ColumnType = "text" | "number" | "date" | "checkbox" | "dropdown";
export type CellValue = string | number | boolean | null;
/** width: the column's width in pixels when someone resized it (otherwise the default). */
export type TableColumn = { id: string; name: string; type: ColumnType; options?: string[]; width?: number };
export const DEFAULT_COLUMN_WIDTH = 140;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 600;
export const clampWidth = (w: number) => Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(w)));

/** A merged block of cells, from its top-left to its bottom-right cell (by row and column id). */
export type Merge = { r1: string; c1: string; r2: string; c2: string };
const MAX_MERGES = 500;
export type TableRow = { id: string; cells: Record<string, CellValue> };
/** Text styling for one cell. Absent keys mean the default (regular, normal size, the app's font). */
/** border lists the cell's drawn sides, in the order t, r, b, l (e.g. "tb"). color is the text color. */
export type CellFormat = { b?: true; i?: true; u?: true; size?: CellSize; font?: CellFont; align?: CellAlign; color?: string; border?: string };
export type CellSize = "sm" | "lg" | "xl";
export type CellFont = "serif" | "mono" | "hand";
export type CellAlign = "left" | "center" | "right";
export const CELL_SIZES: CellSize[] = ["sm", "lg", "xl"];
export const CELL_FONTS: CellFont[] = ["serif", "mono", "hand"];
export const CELL_ALIGNS: CellAlign[] = ["left", "center", "right"];
const SIDES = "trbl";

/** Keeps only real sides, once each, in t-r-b-l order ("" when none). */
export function normalizeSides(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return [...SIDES].filter((side) => raw.includes(side)).join("");
}

/* Text colors for table cells: mid tones that read on both a dark cell and a light highlight. */
export const TEXT_COLORS: { name: string; value: string }[] = [
  { name: "Red", value: "#DC2626" },
  { name: "Orange", value: "#EA580C" },
  { name: "Green", value: "#16A34A" },
  { name: "Blue", value: "#2563EB" },
  { name: "Purple", value: "#9333EA" },
  { name: "Pink", value: "#DB2777" },
  { name: "Gray", value: "#6B7280" },
];

/** fills: cell highlight colors and formats: text styling, both keyed `${rowId}|${columnId}`. */
/** header: the first row is a header row -- kept at the top and left out of sorting and filtering.
 *  freeze: how many of the first rows / columns stay in place while scrolling. */
export type TableContent = { columns: TableColumn[]; rows: TableRow[]; fills?: Record<string, string>; formats?: Record<string, CellFormat>; header?: true; freeze?: Freeze; merges?: Merge[] };
export type Freeze = { rows: number; cols: number };
export const MAX_FREEZE_ROWS = 20;
export const MAX_FREEZE_COLS = 10;

/** A valid freeze setting, or null for "nothing frozen". */
export function normalizeFreeze(raw: unknown): Freeze | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const count = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) ? Math.min(max, Math.max(0, v)) : 0);
  const freeze = { rows: count(r.rows, MAX_FREEZE_ROWS), cols: count(r.cols, MAX_FREEZE_COLS) };
  return freeze.rows > 0 || freeze.cols > 0 ? freeze : null;
}

/* A highlight is any #RRGGBB color: the swatches below, or a color pasted from a spreadsheet. */
const HEX_COLOR = /^#[0-9A-F]{6}$/;
export function normalizeFillColor(color: unknown): string | null {
  return typeof color === "string" && HEX_COLOR.test(color.toUpperCase()) ? color.toUpperCase() : null;
}

/** Keeps only the known format keys; null when nothing is left. */
export function normalizeFormat(raw: unknown): CellFormat | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: CellFormat = {};
  if (r.b === true) out.b = true;
  if (r.i === true) out.i = true;
  if (r.u === true) out.u = true;
  if (CELL_SIZES.includes(r.size as CellSize)) out.size = r.size as CellSize;
  if (CELL_FONTS.includes(r.font as CellFont)) out.font = r.font as CellFont;
  if (CELL_ALIGNS.includes(r.align as CellAlign)) out.align = r.align as CellAlign;
  const color = normalizeFillColor(r.color);
  if (color) out.color = color;
  const border = normalizeSides(r.border);
  if (border) out.border = border;
  return Object.keys(out).length > 0 ? out : null;
}

/* Highlight colors for table cells: light tints, so dark cell text always reads. */
export const FILL_COLORS: { name: string; value: string }[] = [
  { name: "Yellow", value: "#FFF3B0" },
  { name: "Green", value: "#D4F5D4" },
  { name: "Blue", value: "#CFE8FF" },
  { name: "Pink", value: "#FFD6E8" },
  { name: "Orange", value: "#FFDDB8" },
  { name: "Red", value: "#F8B4B4" },
  { name: "Grey", value: "#E5E7EB" },
];
export const fillKey = (rowId: string, columnId: string) => `${rowId}|${columnId}`;
export type NoteContent = { html: string; padColor?: string };
export type ReminderContent = { text: string; due: string | null; done: boolean };
export type BlockContent = TableContent | NoteContent | ReminderContent;
export type Rect = { x: number; y: number; w: number; h: number };

export type Workbook = { id: string; title: string; tags: string[]; bgColor?: string; bgStyle?: string; createdAt: string; updatedAt: string; /** Shared spreadsheets only: who last changed it. */ updatedBy?: string | null };

/* Canvas backgrounds a workbook can choose. Colors are a fixed list of
   literals (the empty value means "the theme's own color"). */
export const BG_COLORS: { name: string; value: string }[] = [
  { name: "Default", value: "" },
  { name: "Paper", value: "#F3F4F6" },
  { name: "Cream", value: "#FBF3DC" },
  { name: "Sky", value: "#DCEBFA" },
  { name: "Mint", value: "#DDF1E4" },
  { name: "Blush", value: "#F8E1E7" },
  { name: "Slate", value: "#1E293B" },
  { name: "Charcoal", value: "#111827" },
];
export const BG_STYLES = ["dots", "grid", "plain"] as const;
export type BgStyle = (typeof BG_STYLES)[number];

/* Anything not on the lists above falls back to the default. */
export function normalizeBackground(color: unknown, style: unknown): { bgColor: string; bgStyle: BgStyle } {
  // Any #RRGGBB color (the list above, or one picked with "More colors").
  const bgColor = normalizeFillColor(color) ?? "";
  const bgStyle = BG_STYLES.find((s) => s === style) ?? "dots";
  return { bgColor, bgStyle };
}

/* True when white dots/lines read better than dark ones on this color. */
export function isDarkColor(hex: string): boolean {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance < 0.5;
}
export type Sheet = { id: string; workbookId: string; name: string; sortOrder: number };
export type Block = { id: string; sheetId: string; kind: BlockKind; x: number; y: number; w: number; h: number; z: number; content: BlockContent };
export type WorkspaceData = { workbooks: Workbook[]; sheets: Sheet[]; blocks: Block[] };

export const MAX_COLUMNS = 30;
export const MAX_ROWS = 1000;
export const MAX_RECT = 1200;
const MAX_POSITION = 100000;
const MAX_CELL_LENGTH = 5000;
const MAX_CONTENT_JSON = 3_000_000;
const MAX_NOTE_LENGTH = 200000;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;
const MAX_NAME_LENGTH = 60;

export const MIN_SIZE: Record<BlockKind, { w: number; h: number }> = {
  table: { w: 240, h: 120 },
  note: { w: 160, h: 100 },
  reminder: { w: 240, h: 130 },
};
const DEFAULT_SIZE: Record<BlockKind, { w: number; h: number }> = {
  table: { w: 480, h: 280 },
  note: { w: 260, h: 180 },
  reminder: { w: 300, h: 160 },
};

/** First spot (top to bottom, left to right on a grid) where a block of `size`
    clears every rect by `gap`; below the lowest block if the scan finds none. */
export function findFreePosition(
  rects: { x: number; y: number; w: number; h: number }[],
  size: { w: number; h: number },
  options: { maxX?: number; step?: number; gap?: number } = {},
): { x: number; y: number } {
  const step = Math.max(1, options.step ?? 24);
  const gap = Math.max(0, options.gap ?? 16);
  const maxX = Math.max(step, options.maxX ?? 720);
  const bottom = rects.reduce((max, r) => Math.max(max, r.y + r.h), 0);
  const hits = (x: number, y: number) =>
    rects.some((r) => x < r.x + r.w + gap && x + size.w + gap > r.x && y < r.y + r.h + gap && y + size.h + gap > r.y);
  for (let y = step; y <= bottom + step; y += step) {
    for (let x = step; x <= maxX; x += step) {
      if (!hits(x, y)) return { x, y };
    }
  }
  return { x: step, y: Math.max(step, bottom + gap) };
}

const RESERVED_IDS = ["__proto__", "constructor", "prototype"];
const COLUMN_TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "dropdown"];
/** A short id for a table row or column (unique within its table; keeps saved tables small). */
export const newCellId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const newId = newCellId;

/** Spreadsheet-style column names: A..Z, AA, AB, ... */
export function columnName(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "";
  let n = Math.floor(index);
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

export function defaultContent(kind: BlockKind): BlockContent {
  if (kind === "note") return { html: "" };
  if (kind === "reminder") return { text: "", due: null, done: false };
  const columns: TableColumn[] = [0, 1, 2].map((i) => ({ id: newId(), name: columnName(i), type: "text" }));
  const rows: TableRow[] = [0, 1, 2].map(() => ({ id: newId(), cells: {} }));
  return { columns, rows };
}

export function defaultRect(kind: BlockKind, x = 0, y = 0): Rect {
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), ...DEFAULT_SIZE[kind] };
}

/* Position is only clamped at the top-left (never negative) -- the canvas
   grows right and down and scrolls, so a block can never end up somewhere
   unreachable. */
export function clampRect(rect: Rect, kind: BlockKind): Rect {
  const min = MIN_SIZE[kind];
  const bound = (value: number, low: number, high: number) => (Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : low);
  return {
    x: bound(rect.x, 0, MAX_POSITION),
    y: bound(rect.y, 0, MAX_POSITION),
    w: bound(rect.w, min.w, MAX_RECT),
    h: bound(rect.h, min.h, MAX_RECT),
  };
}

/** True only for dates that exist on the calendar. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1) return false;
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Accepts YYYY-MM-DD or M/D/YYYY and returns a valid ISO date, or null. */
function normalizeDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return isRealDate(+iso[1], +iso[2], +iso[3]) ? text : null;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us && isRealDate(+us[3], +us[1], +us[2])) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

/** Parses text copied from Excel / Google Sheets: tab-separated, quoted cells may hold tabs and newlines. */
export function parsePastedGrid(text: string): string[][] {
  if (!text) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushRow = () => { rows.push(row.slice(0, MAX_COLUMNS)); row = []; };
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      pushRow();
    } else cell += ch;
  }
  if (rows.length < MAX_ROWS && (cell !== "" || row.length > 0)) { row.push(cell); pushRow(); }
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  return rows;
}

export function coerceCell(raw: CellValue | undefined, type: ColumnType, options?: string[]): CellValue {
  if (raw === undefined || raw === null) return null;
  if (type === "checkbox") {
    if (typeof raw === "boolean") return raw;
    if (String(raw).trim() === "") return null;
    return ["true", "yes", "y", "1", "x", "✓"].includes(String(raw).trim().toLowerCase());
  }
  const text = typeof raw === "string" ? raw.trim() : String(raw);
  // A formula (=A1+B1) is kept as typed in text and number columns; it is worked out when shown.
  if ((type === "text" || type === "number") && typeof raw === "string" && text.length > 1 && text.startsWith("=")) return text;
  if (type === "text") {
    if (typeof raw === "number" && !Number.isFinite(raw)) return null;
    return text === "" ? null : String(raw);
  }
  if (text === "") return null;
  if (type === "number") {
    const plain = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text);
    const grouped = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text);
    if (!plain && !grouped) return null;
    const n = Number(text.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date") return normalizeDate(text);
  if (type === "dropdown") {
    return (options || []).find((o) => o.toLowerCase() === text.toLowerCase()) ?? null;
  }
  return null;
}

/** Appends a blank row. A given id makes this repeatable: a row that already exists isn't added twice. */
export function addRow(content: TableContent, id?: string): TableContent {
  if (content.rows.length >= MAX_ROWS) return content;
  if (id && content.rows.some((r) => r.id === id)) return content;
  return { ...content, rows: [...content.rows, { id: id ?? newId(), cells: {} }] };
}

function pruneCellMap<T>(map: Record<string, T> | undefined, keep: (rowId: string, columnId: string) => boolean): Record<string, T> | undefined {
  if (!map) return undefined;
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    const [rowId, columnId] = key.split("|");
    if (keep(rowId, columnId)) next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/* Replaces the fills/formats maps, leaving a key out entirely when its map is empty. */
function withCellMaps(content: TableContent, fills: Record<string, string> | undefined, formats: Record<string, CellFormat> | undefined): TableContent {
  const { fills: _f, formats: _m, ...rest } = content;
  void _f;
  void _m;
  return { ...rest, ...(fills && Object.keys(fills).length > 0 ? { fills } : {}), ...(formats && Object.keys(formats).length > 0 ? { formats } : {}) };
}

export function removeRow(content: TableContent, rowId: string): TableContent {
  const keep = (r: string) => r !== rowId;
  return withCellMaps({ ...content, rows: content.rows.filter((r) => r.id !== rowId) }, pruneCellMap(content.fills, keep), pruneCellMap(content.formats, keep));
}

/** Sets (or, with null or an unknown color, clears) the highlight of several cells at once. */
export function setFills(content: TableContent, cells: [string, string][], color: string | null): TableContent {
  const rowIds = new Set(content.rows.map((r) => r.id));
  const columnIds = new Set(content.columns.map((c) => c.id));
  const valid = normalizeFillColor(color);
  const fills = { ...(content.fills ?? {}) };
  let changed = false;
  for (const [rowId, columnId] of cells) {
    if (!rowIds.has(rowId) || !columnIds.has(columnId)) continue;
    const key = fillKey(rowId, columnId);
    if (valid) fills[key] = valid;
    else delete fills[key];
    changed = true;
  }
  if (!changed) return content;
  return withCellMaps(content, fills, content.formats);
}

/** A change to apply to cells' formats: true/false turns a style on/off, null resets size or font. */
/** A change to cells' formats. borderOn/borderOff add or remove sides ("trbl"), keeping the others. */
export type FormatPatch = { b?: boolean; i?: boolean; u?: boolean; size?: CellSize | null; font?: CellFont | null; align?: CellAlign | null; color?: string | null; borderOn?: string; borderOff?: string };

export function setFormats(content: TableContent, cells: [string, string][], patch: FormatPatch): TableContent {
  const rowIds = new Set(content.rows.map((r) => r.id));
  const columnIds = new Set(content.columns.map((c) => c.id));
  const formats = { ...(content.formats ?? {}) };
  let changed = false;
  for (const [rowId, columnId] of cells) {
    if (!rowIds.has(rowId) || !columnIds.has(columnId)) continue;
    const key = fillKey(rowId, columnId);
    const next: Record<string, unknown> = { ...(formats[key] ?? {}) };
    for (const flag of ["b", "i", "u"] as const) {
      if (patch[flag] === true) next[flag] = true;
      else if (patch[flag] === false) delete next[flag];
    }
    if (patch.size !== undefined) next.size = patch.size ?? undefined;
    if (patch.font !== undefined) next.font = patch.font ?? undefined;
    if (patch.align !== undefined) next.align = patch.align ?? undefined;
    if (patch.color !== undefined) next.color = patch.color ?? undefined;
    if (patch.borderOn || patch.borderOff) {
      const on = normalizeSides(patch.borderOn);
      const off = normalizeSides(patch.borderOff);
      const current = normalizeSides(next.border);
      next.border = [...SIDES].filter((side) => (current.includes(side) || on.includes(side)) && !off.includes(side)).join("") || undefined;
    }
    const clean = normalizeFormat(next);
    if (clean) formats[key] = clean;
    else delete formats[key];
    changed = true;
  }
  if (!changed) return content;
  return withCellMaps(content, content.fills, formats);
}

/** Gives each listed cell exactly this highlight and format (null removes it). */
export function setCellStyles(content: TableContent, cells: [string, string, string | null, CellFormat | null][]): TableContent {
  const rowIds = new Set(content.rows.map((r) => r.id));
  const columnIds = new Set(content.columns.map((c) => c.id));
  const fills = { ...(content.fills ?? {}) };
  const formats = { ...(content.formats ?? {}) };
  for (const [rowId, columnId, fill, format] of cells) {
    if (!rowIds.has(rowId) || !columnIds.has(columnId)) continue;
    const key = fillKey(rowId, columnId);
    const cleanFill = normalizeFillColor(fill);
    const cleanFormat = normalizeFormat(format);
    if (cleanFill) fills[key] = cleanFill;
    else delete fills[key];
    if (cleanFormat) formats[key] = cleanFormat;
    else delete formats[key];
  }
  return withCellMaps(content, fills, formats);
}

/** Styling carried over from a pasted spreadsheet range, one entry per pasted cell. */
export type PastedStyle = { fill?: string; format?: CellFormat };

/** Gives the pasted area the pasted styling: each cell gets its style, or loses any it had. */
export function applyPasteStyles(content: TableContent, startRow: number, startCol: number, styles: (PastedStyle | null)[][]): TableContent {
  const fills = { ...(content.fills ?? {}) };
  const formats = { ...(content.formats ?? {}) };
  styles.forEach((line, r) => {
    const row = content.rows[startRow + r];
    if (!row) return;
    line.forEach((style, c) => {
      const column = content.columns[startCol + c];
      if (!column) return;
      const key = fillKey(row.id, column.id);
      const fill = normalizeFillColor(style?.fill);
      const format = normalizeFormat(style?.format);
      if (fill) fills[key] = fill;
      else delete fills[key];
      if (format) formats[key] = format;
      else delete formats[key];
    });
  });
  return withCellMaps(content, fills, formats);
}

/** Sets (or, with null, clears) one cell's highlight. */
export function setFill(content: TableContent, rowId: string, columnId: string, color: string | null): TableContent {
  return setFills(content, [[rowId, columnId]], color);
}

/** Puts one value into several cells (null clears them), coerced to each column's type. Rows that don't change keep their identity. */
export function setCells(content: TableContent, cells: [string, string][], value: CellValue): TableContent {
  const byRow = new Map<string, string[]>();
  for (const [rowId, columnId] of cells) {
    const list = byRow.get(rowId);
    if (list) list.push(columnId);
    else byRow.set(rowId, [columnId]);
  }
  const columnsById = new Map(content.columns.map((c) => [c.id, c]));
  let changed = false;
  const rows = content.rows.map((row) => {
    const targets = byRow.get(row.id);
    if (!targets) return row;
    let next: Record<string, CellValue> | null = null;
    for (const columnId of targets) {
      const column = columnsById.get(columnId);
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

export function addColumn(content: TableContent, name?: string, type: ColumnType = "text", id?: string): TableContent {
  if (content.columns.length >= MAX_COLUMNS) return content;
  if (id && content.columns.some((c) => c.id === id)) return content;
  const column: TableColumn = { id: id ?? newId(), name: ((name || "").trim() || columnName(content.columns.length)).slice(0, MAX_NAME_LENGTH), type };
  return { ...content, columns: [...content.columns, column] };
}

export function removeColumn(content: TableContent, columnId: string): TableContent {
  if (content.columns.length <= 1) return content;
  const keep = (_r: string, c: string) => c !== columnId;
  return withCellMaps(
    {
      ...content,
      columns: content.columns.filter((c) => c.id !== columnId),
      rows: content.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[columnId];
        return { ...r, cells };
      }),
    },
    pruneCellMap(content.fills, keep),
    pruneCellMap(content.formats, keep),
  );
}

export function renameColumn(content: TableContent, columnId: string, name: string): TableContent {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return content;
  return { ...content, columns: content.columns.map((c) => (c.id === columnId ? { ...c, name: trimmed } : c)) };
}

export function setColumnType(content: TableContent, columnId: string, type: ColumnType, options?: string[]): TableContent {
  const columns = content.columns.map((c) => {
    if (c.id !== columnId) return c;
    const next: TableColumn = { id: c.id, name: c.name, type, ...(c.width ? { width: c.width } : {}) };
    if (type === "dropdown") next.options = options ?? c.options ?? [];
    return next;
  });
  const column = columns.find((c) => c.id === columnId);
  if (!column) return content;
  return {
    ...content,
    columns,
    rows: content.rows.map((r) => ({ ...r, cells: { ...r.cells, [columnId]: coerceCell(Object.hasOwn(r.cells, columnId) ? r.cells[columnId] : null, column.type, column.options) } })),
  };
}

export function setCell(content: TableContent, rowId: string, columnId: string, value: CellValue): TableContent {
  const column = content.columns.find((c) => c.id === columnId);
  if (!column) return content;
  return {
    ...content,
    rows: content.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: coerceCell(value, column.type, column.options) } } : r)),
  };
}

/** Pastes a grid with its top-left at (startRow, startCol), adding rows/columns as needed up to the limits. */
export function applyPaste(content: TableContent, startRow: number, startCol: number, grid: string[][]): TableContent {
  if (grid.length === 0) return content;
  if (!Number.isFinite(startRow) || !Number.isFinite(startCol) || startRow < 0 || startCol < 0) return content;
  startRow = Math.trunc(startRow);
  startCol = Math.trunc(startCol);
  let next: TableContent = { ...content, columns: [...content.columns], rows: content.rows.map((r) => ({ ...r, cells: { ...r.cells } })) };
  let width = 0;
  for (const line of grid) if (line.length > width) width = line.length;
  const neededCols = Math.min(MAX_COLUMNS, startCol + width);
  while (next.columns.length < neededCols) next = addColumn(next);
  const neededRows = Math.min(MAX_ROWS, startRow + grid.length);
  while (next.rows.length < neededRows) next = addRow(next);
  grid.forEach((line, r) => {
    const row = next.rows[startRow + r];
    if (!row) return;
    line.forEach((value, c) => {
      const column = next.columns[startCol + c];
      if (!column) return;
      row.cells[column.id] = coerceCell(value, column.type, column.options);
    });
  });
  return next;
}

/** A new table holding a pasted range. Columns whose every value is a number become Number columns. */
export function tableFromGrid(grid: string[][]): TableContent {
  let width = 1;
  for (const line of grid) if (line.length > width) width = line.length;
  width = Math.min(width, MAX_COLUMNS);
  const lines = grid.slice(0, MAX_ROWS);
  const columns: TableColumn[] = Array.from({ length: width }, (_, i) => {
    const values = lines.map((line) => (line[i] ?? "").trim()).filter((v) => v !== "");
    const numeric = values.length > 0 && values.every((v) => v.startsWith("=") || coerceCell(v, "number") !== null);
    return { id: newId(), name: columnName(i), type: numeric ? "number" : "text" };
  });
  const rows: TableRow[] = lines.map((line) => {
    const cells: Record<string, CellValue> = {};
    columns.forEach((column, i) => {
      const value = coerceCell(line[i] ?? "", column.type);
      if (value !== null) cells[column.id] = typeof value === "string" ? value.slice(0, MAX_CELL_LENGTH) : value;
    });
    return { id: newId(), cells };
  });
  return { columns, rows: rows.length > 0 ? rows : [{ id: newId(), cells: {} }] };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/* Everything the client sends for a block is untrusted: unknown keys are
   dropped, values are coerced or nulled, sizes are bounded. Returns null
   when the content can't be salvaged at all. The note HTML sanitizer is
   passed in so this file stays free of server-only imports. */
export function validateBlockContent(kind: BlockKind, raw: unknown, sanitizeHtml: (html: string) => string): BlockContent | null {
  if (!isPlainObject(raw)) return null;
  if (kind === "note") {
    const html = typeof raw.html === "string" ? raw.html : "";
    if (html.length > MAX_NOTE_LENGTH) return null;
    const padColor = typeof raw.padColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.padColor) ? raw.padColor.toUpperCase() : undefined;
    return { html: html ? sanitizeHtml(html) : "", ...(padColor ? { padColor } : {}) };
  }
  if (kind === "reminder") {
    const text = typeof raw.text === "string" ? raw.text.trim().slice(0, 500) : "";
    const due = typeof raw.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) ? normalizeDate(raw.due) : null;
    return { text, due, done: raw.done === true };
  }
  if (kind !== "table") return null;
  if (!Array.isArray(raw.columns) || raw.columns.length === 0 || raw.columns.length > MAX_COLUMNS) return null;
  if (!Array.isArray(raw.rows) || raw.rows.length > MAX_ROWS) return null;
  const columns: TableColumn[] = [];
  const seenColumns = new Set<string>();
  const seenRows = new Set<string>();
  const uniqueId = (candidate: unknown, seen: Set<string>): string => {
    let id = typeof candidate === "string" && /^[\w-]{1,64}$/.test(candidate) && !RESERVED_IDS.includes(candidate) && !(candidate in Object.prototype) && !seen.has(candidate) ? candidate : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    return id;
  };
  for (const c of raw.columns) {
    if (!isPlainObject(c)) return null;
    const type = COLUMN_TYPES.includes(c.type as ColumnType) ? (c.type as ColumnType) : "text";
    const column: TableColumn = {
      id: uniqueId(c.id, seenColumns),
      name: (typeof c.name === "string" ? c.name.trim() : "").slice(0, MAX_NAME_LENGTH) || "Column",
      type,
    };
    if (typeof c.width === "number" && Number.isFinite(c.width)) column.width = clampWidth(c.width);
    if (type === "dropdown") {
      column.options = Array.isArray(c.options)
        ? c.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim().slice(0, MAX_NAME_LENGTH)).slice(0, 100)
        : [];
    }
    columns.push(column);
  }
  const rows: TableRow[] = [];
  for (const r of raw.rows) {
    if (!isPlainObject(r)) return null;
    const cellsIn = isPlainObject(r.cells) ? r.cells : {};
    const cells: Record<string, CellValue> = {};
    for (const column of columns) {
      if (!Object.hasOwn(cellsIn, column.id)) continue;
      const value = cellsIn[column.id];
      const scalar = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
      const coerced = coerceCell(scalar, column.type, column.options);
      cells[column.id] = typeof coerced === "string" ? coerced.slice(0, MAX_CELL_LENGTH) : coerced;
    }
    rows.push({ id: uniqueId(r.id, seenRows), cells });
  }
  const result: TableContent = { columns, rows };
  if (raw.header === true) result.header = true;
  if (Array.isArray(raw.merges)) {
    // Kept even if a row or column in it is gone for now (an undo can bring it back); the grid skips those.
    const merges = raw.merges
      .filter((m): m is Merge => isPlainObject(m) && ["r1", "c1", "r2", "c2"].every((k) => typeof m[k] === "string" && /^[\w-]{1,64}$/.test(m[k] as string)))
      .map((m) => ({ r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2 }))
      .slice(0, MAX_MERGES);
    if (merges.length > 0) result.merges = merges;
  }
  const freeze = normalizeFreeze(raw.freeze);
  if (freeze) result.freeze = freeze;
  if (isPlainObject(raw.fills)) {
    const rowIds = new Set(rows.map((r) => r.id));
    const columnIds = new Set(columns.map((c) => c.id));
    const fills: Record<string, string> = {};
    for (const [key, color] of Object.entries(raw.fills)) {
      const [rowId, columnId] = key.split("|");
      const clean = normalizeFillColor(color);
      if (clean && rowIds.has(rowId) && columnIds.has(columnId)) fills[key] = clean;
    }
    if (Object.keys(fills).length > 0) result.fills = fills;
  }
  if (isPlainObject(raw.formats)) {
    const rowIds = new Set(rows.map((r) => r.id));
    const columnIds = new Set(columns.map((c) => c.id));
    const formats: Record<string, CellFormat> = {};
    for (const [key, format] of Object.entries(raw.formats)) {
      const [rowId, columnId] = key.split("|");
      const clean = normalizeFormat(format);
      if (clean && rowIds.has(rowId) && columnIds.has(columnId)) formats[key] = clean;
    }
    if (Object.keys(formats).length > 0) result.formats = formats;
  }
  if (JSON.stringify(result).length > MAX_CONTENT_JSON) return null;
  return result;
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim().slice(0, MAX_TAG_LENGTH);
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

const TAG_COLORS = ["teal", "violet", "amber", "rose", "sky", "green", "orange", "slate"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export function tagColor(tag: string): TagColor {
  let hash = 0;
  for (const ch of tag.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export function dueState(due: string | null, todayIso: string): "none" | "overdue" | "today" | "upcoming" {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return "none";
  if (due < todayIso) return "overdue";
  if (due === todayIso) return "today";
  return "upcoming";
}
