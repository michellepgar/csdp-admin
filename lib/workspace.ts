export type BlockKind = "table" | "note" | "reminder";
export type ColumnType = "text" | "number" | "date" | "checkbox" | "dropdown";
export type CellValue = string | number | boolean | null;
export type TableColumn = { id: string; name: string; type: ColumnType; options?: string[] };
export type TableRow = { id: string; cells: Record<string, CellValue> };
export type TableContent = { columns: TableColumn[]; rows: TableRow[] };
export type NoteContent = { html: string };
export type ReminderContent = { text: string; due: string | null; done: boolean };
export type BlockContent = TableContent | NoteContent | ReminderContent;
export type Rect = { x: number; y: number; w: number; h: number };

export type Workbook = { id: string; title: string; tags: string[]; createdAt: string; updatedAt: string };
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
const newId = () => crypto.randomUUID();

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

export function addRow(content: TableContent): TableContent {
  if (content.rows.length >= MAX_ROWS) return content;
  return { ...content, rows: [...content.rows, { id: newId(), cells: {} }] };
}

export function removeRow(content: TableContent, rowId: string): TableContent {
  return { ...content, rows: content.rows.filter((r) => r.id !== rowId) };
}

export function addColumn(content: TableContent, name?: string, type: ColumnType = "text"): TableContent {
  if (content.columns.length >= MAX_COLUMNS) return content;
  const column: TableColumn = { id: newId(), name: ((name || "").trim() || columnName(content.columns.length)).slice(0, MAX_NAME_LENGTH), type };
  return { ...content, columns: [...content.columns, column] };
}

export function removeColumn(content: TableContent, columnId: string): TableContent {
  if (content.columns.length <= 1) return content;
  return {
    columns: content.columns.filter((c) => c.id !== columnId),
    rows: content.rows.map((r) => {
      const cells = { ...r.cells };
      delete cells[columnId];
      return { ...r, cells };
    }),
  };
}

export function renameColumn(content: TableContent, columnId: string, name: string): TableContent {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return content;
  return { ...content, columns: content.columns.map((c) => (c.id === columnId ? { ...c, name: trimmed } : c)) };
}

export function setColumnType(content: TableContent, columnId: string, type: ColumnType, options?: string[]): TableContent {
  const columns = content.columns.map((c) => {
    if (c.id !== columnId) return c;
    const next: TableColumn = { id: c.id, name: c.name, type };
    if (type === "dropdown") next.options = options ?? c.options ?? [];
    return next;
  });
  const column = columns.find((c) => c.id === columnId);
  if (!column) return content;
  return {
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
  let next: TableContent = { columns: [...content.columns], rows: content.rows.map((r) => ({ ...r, cells: { ...r.cells } })) };
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
    return { html: html ? sanitizeHtml(html) : "" };
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
