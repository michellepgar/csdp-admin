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

export const MAX_COLUMNS = 40;
export const MAX_ROWS = 2000;
export const MAX_RECT = 1200;
const MAX_NOTE_LENGTH = 200000;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;
const MAX_NAME_LENGTH = 60;

export const MIN_SIZE: Record<BlockKind, { w: number; h: number }> = {
  table: { w: 240, h: 120 },
  note: { w: 160, h: 100 },
  reminder: { w: 220, h: 80 },
};
const DEFAULT_SIZE: Record<BlockKind, { w: number; h: number }> = {
  table: { w: 480, h: 280 },
  note: { w: 260, h: 180 },
  reminder: { w: 280, h: 110 },
};

const COLUMN_TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "dropdown"];
const newId = () => crypto.randomUUID();

/** Spreadsheet-style column names: A..Z, AA, AB, ... */
export function columnName(index: number): string {
  let n = index;
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
  const bound = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Math.round(value)));
  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    w: bound(rect.w, min.w, MAX_RECT),
    h: bound(rect.h, min.h, MAX_RECT),
  };
}

/** Parses text copied from Excel / Google Sheets: tab-separated, quoted cells may hold tabs and newlines. */
export function parsePastedGrid(text: string): string[][] {
  if (!text) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
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
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function coerceCell(raw: CellValue | undefined, type: ColumnType, options?: string[]): CellValue {
  if (raw === undefined || raw === null) return null;
  if (type === "checkbox") {
    if (typeof raw === "boolean") return raw;
    return ["true", "yes", "y", "1", "x", "✓"].includes(String(raw).trim().toLowerCase());
  }
  const text = typeof raw === "string" ? raw.trim() : String(raw);
  if (type === "text") return text === "" ? null : String(raw);
  if (text === "") return null;
  if (type === "number") {
    const n = Number(text.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return null;
  }
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
  const column: TableColumn = { id: newId(), name: (name || columnName(content.columns.length)).slice(0, MAX_NAME_LENGTH), type };
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
    rows: content.rows.map((r) => ({ ...r, cells: { ...r.cells, [columnId]: coerceCell(r.cells[columnId], column.type, column.options) } })),
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
  let next: TableContent = { columns: [...content.columns], rows: content.rows.map((r) => ({ ...r, cells: { ...r.cells } })) };
  const neededCols = Math.min(MAX_COLUMNS, startCol + Math.max(0, ...grid.map((r) => r.length)));
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
    const due = typeof raw.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) ? raw.due : null;
    return { text, due, done: raw.done === true };
  }
  if (!Array.isArray(raw.columns) || raw.columns.length === 0 || raw.columns.length > MAX_COLUMNS) return null;
  if (!Array.isArray(raw.rows) || raw.rows.length > MAX_ROWS) return null;
  const columns: TableColumn[] = [];
  for (const c of raw.columns) {
    if (!isPlainObject(c)) return null;
    const type = COLUMN_TYPES.includes(c.type as ColumnType) ? (c.type as ColumnType) : "text";
    const column: TableColumn = {
      id: typeof c.id === "string" && c.id ? c.id : newId(),
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
      const value = cellsIn[column.id];
      if (value === undefined) continue;
      const scalar = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
      cells[column.id] = coerceCell(scalar, column.type, column.options);
    }
    rows.push({ id: typeof r.id === "string" && r.id ? r.id : newId(), cells });
  }
  return { columns, rows };
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
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
  if (!due) return "none";
  if (due < todayIso) return "overdue";
  if (due === todayIso) return "today";
  return "upcoming";
}
