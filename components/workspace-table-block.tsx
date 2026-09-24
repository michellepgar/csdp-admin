"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ClipboardEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, Baseline, Redo2, Undo2, Bold, Calendar, Grid2x2, Hash, Italic, ListChecks, ListFilter, PaintBucket, PanelBottom, PanelLeft, PanelRight, PanelTop, Plus, Snowflake, Square, SquareCheck, SquareDashed, TextAlignCenter, TextAlignEnd, TextAlignStart, Trash2, Type, Underline, X } from "lucide-react";
import { ColorWell } from "@/components/color-well";
import { KebabMenu } from "@/components/kebab-menu";
import type { KebabMenuItem } from "@/components/kebab-menu";
import { FILL_COLORS, MAX_COLUMNS, MAX_FREEZE_COLS, MAX_FREEZE_ROWS, MAX_ROWS, TEXT_COLORS, coerceCell, columnName, newCellId, parsePastedGrid } from "@/lib/workspace";
import { applySheetOps, invertSheetOps, pasteOps } from "@/lib/sheet-ops";
import type { SheetOp } from "@/lib/sheet-ops";
import { readClipboardTableStyles } from "@/lib/clipboard-table";
import { evaluateTable, isFormula } from "@/lib/workspace-formula";
import type { CellAlign, CellFont, CellFormat, CellSize, CellValue, ColumnType, FormatPatch, TableColumn, TableContent, TableRow } from "@/lib/workspace";

const COLUMN_WIDTH = 140;
const GUTTER_WIDTH = 56;
/* Fixed heights (the column-name row is h-9 plus its bottom line; a body row
   is h-8 plus its bottom line), used to stack frozen rows under each other. */
const HEAD_ROW_HEIGHT = 37;
const BODY_ROW_HEIGHT = 33;
const ADD_COLUMN_WIDTH = 44;
const MAX_UNDO = 100;

const TYPE_META: Record<ColumnType, { label: string; icon: ReactNode }> = {
  text: { label: "Text", icon: <Type className="h-3 w-3" aria-hidden /> },
  number: { label: "Number", icon: <Hash className="h-3 w-3" aria-hidden /> },
  date: { label: "Date", icon: <Calendar className="h-3 w-3" aria-hidden /> },
  checkbox: { label: "Checkbox", icon: <SquareCheck className="h-3 w-3" aria-hidden /> },
  dropdown: { label: "Dropdown", icon: <ListChecks className="h-3 w-3" aria-hidden /> },
};
const TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "dropdown"];

const EDITOR = "h-8 w-full min-w-0 bg-background px-2 text-sm text-foreground outline-none";
const SELECTED_TINT = "linear-gradient(color-mix(in oklab, var(--ring) 12%, transparent), color-mix(in oklab, var(--ring) 12%, transparent))";
// A range gets only a faint wash so highlight colors stay visible; a single cell gets just its outline.
const RANGE_TINT = "linear-gradient(color-mix(in oklab, var(--ring) 7%, transparent), color-mix(in oklab, var(--ring) 7%, transparent))";

const FONT_OPTIONS: { value: CellFont | ""; label: string; css?: string }[] = [
  { value: "", label: "Sans" },
  { value: "serif", label: "Serif", css: "Georgia, serif" },
  { value: "mono", label: "Mono", css: "ui-monospace, Menlo, monospace" },
  { value: "hand", label: "Handwritten", css: '"Comic Sans MS", "Comic Sans", cursive' },
];
const SIZE_OPTIONS: { value: CellSize | ""; label: string; px: number }[] = [
  { value: "sm", label: "Small", px: 12 },
  { value: "", label: "Normal", px: 14 },
  { value: "lg", label: "Large", px: 16 },
  { value: "xl", label: "Extra large", px: 18 },
];

/* Inline text styling for a formatted cell (display and editor alike). */
function formatStyle(format: CellFormat | undefined): CSSProperties | undefined {
  if (!format) return undefined;
  const style: CSSProperties = {};
  if (format.b) style.fontWeight = 700;
  if (format.i) style.fontStyle = "italic";
  if (format.u) style.textDecoration = "underline";
  const size = format.size ? SIZE_OPTIONS.find((s) => s.value === format.size) : undefined;
  if (size) style.fontSize = size.px;
  const font = FONT_OPTIONS.find((f) => f.value === format.font && f.css);
  if (font) style.fontFamily = font.css;
  if (format.align) style.textAlign = format.align;
  if (format.color) style.color = format.color;
  return style;
}

/* A cell's drawn borders, as inset lines in the cell's own text color (so they show on any background). */
const SIDE_SHADOW: Record<string, string> = {
  t: "inset 0 1px 0 0 currentColor",
  r: "inset -1px 0 0 0 currentColor",
  b: "inset 0 -1px 0 0 currentColor",
  l: "inset 1px 0 0 0 currentColor",
};

type BorderChoice = "all" | "outside" | "top" | "bottom" | "left" | "right" | "none";
const BORDER_CHOICES: { value: BorderChoice; label: string; icon: ReactNode }[] = [
  { value: "all", label: "All borders", icon: <Grid2x2 className="h-4 w-4" /> },
  { value: "outside", label: "Outside borders", icon: <Square className="h-4 w-4" /> },
  { value: "top", label: "Top border", icon: <PanelTop className="h-4 w-4" /> },
  { value: "bottom", label: "Bottom border", icon: <PanelBottom className="h-4 w-4" /> },
  { value: "left", label: "Left border", icon: <PanelLeft className="h-4 w-4" /> },
  { value: "right", label: "Right border", icon: <PanelRight className="h-4 w-4" /> },
  { value: "none", label: "No borders", icon: <SquareDashed className="h-4 w-4" /> },
];

const ALIGN_CHOICES: { value: CellAlign; label: string; icon: ReactNode }[] = [
  { value: "left", label: "Align left", icon: <TextAlignStart className="h-3.5 w-3.5" /> },
  { value: "center", label: "Align center", icon: <TextAlignCenter className="h-3.5 w-3.5" /> },
  { value: "right", label: "Align right", icon: <TextAlignEnd className="h-3.5 w-3.5" /> },
];

/* A row of color swatches plus a "none" choice, used for text color and highlight. */
function SwatchPanel({ colors, noneLabel, current, onPick, close }: { colors: { name: string; value: string }[]; noneLabel: string; current: string | undefined; onPick: (color: string | null) => void; close: () => void }) {
  return (
    <div className="w-44 space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={current === c.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(c.value);
              close();
            }}
            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${current === c.value ? "border-foreground" : "border-border"}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 px-2 text-sm text-foreground">
        <ColorWell
          title="More colors"
          size="h-6 w-6"
          value={current}
          active={!!current && !colors.some((c) => c.value === current)}
          onCommit={(hex) => {
            onPick(hex);
            close();
          }}
        />
        More colors…
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onPick(null);
          close();
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-sm text-foreground transition-colors hover:bg-ring/10"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" /> {noneLabel}
      </button>
    </div>
  );
}

/* Excel-style filter for one column: tick the values to show. */
function FilterPanel({ values, selected, onApply, close }: { values: string[]; selected: string[] | null; onApply: (allowed: string[] | null) => void; close: () => void }) {
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected ?? values));
  const needle = search.trim().toLowerCase();
  const matching = values.filter((v) => (v === "" ? "(blanks)" : v.toLowerCase()).includes(needle));
  const shownValues = matching.slice(0, 300);
  const allChecked = matching.length > 0 && matching.every((v) => checked.has(v));

  function toggle(value: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const v of matching) {
        if (allChecked) next.delete(v);
        else next.add(v);
      }
      return next;
    });
  }

  return (
    <div className="w-60 space-y-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search values…"
        aria-label="Search values"
        autoFocus
        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
        <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm font-medium hover:bg-ring/10">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-3.5 w-3.5" />
          {needle ? "Select all matches" : "Select all"}
        </label>
        {shownValues.map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-ring/10">
            <input type="checkbox" checked={checked.has(value)} onChange={() => toggle(value)} className="h-3.5 w-3.5" />
            <span className={`truncate ${value === "" ? "italic text-muted-foreground" : ""}`}>{value === "" ? "(Blanks)" : value}</span>
          </label>
        ))}
        {matching.length > shownValues.length && <p className="px-1.5 py-1 text-xs text-muted-foreground">Showing the first 300. Search to narrow it down.</p>}
        {matching.length === 0 && <p className="px-1.5 py-1 text-xs text-muted-foreground">No matching values.</p>}
      </div>
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onApply(null);
            close();
          }}
          className="rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-ring/10 hover:text-foreground"
        >
          Clear filter
        </button>
        <button
          type="button"
          disabled={checked.size === 0}
          onClick={() => {
            onApply(checked.size === values.length ? null : [...checked]);
            close();
          }}
          className="rounded-lg bg-ring/15 px-3 py-1 text-sm font-medium text-ring transition-colors hover:bg-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

const cellOf = (row: TableRow, columnId: string): CellValue => (Object.hasOwn(row.cells, columnId) ? row.cells[columnId] : null);

/* What a cell shows when it isn't being edited (and what Copy puts on the clipboard). */
function displayText(raw: CellValue, column: TableColumn, computed?: string): string {
  if (computed !== undefined) return computed;
  if (raw === null || raw === undefined) return "";
  if (column.type === "checkbox") return raw === true ? "TRUE" : "";
  if (column.type === "date" && typeof raw === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : raw;
  }
  return String(raw);
}

/* A position on screen: r is the row's place among the rows shown (sorting and
   filtering change it), c is the column index. */
type Pos = { r: number; c: number };
type Selection = { anchor: Pos; focus: Pos };
type Editing = { rowId: string; colId: string; initial: string | null };
type Move = "down" | "right" | "none";
const samePos = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c;

/* Every handler the rows need. Built once and never changes identity; each
   one reads the latest state from refs, so memoized rows never act on a
   stale copy. */
type TableApi = {
  /** Applies edits locally and reports them; unless `record` is false they can be undone. */
  run: (ops: SheetOp[], record?: boolean) => void;
  cellMouseDown: (e: MouseEvent, pos: Pos) => void;
  cellMouseEnter: (pos: Pos) => void;
  rowMouseDown: (e: MouseEvent, r: number) => void;
  startEdit: (pos: Pos, initial: string | null) => void;
  /** value undefined = throw the edit away. */
  finishEdit: (rowId: string, columnId: string, value: string | undefined, move: Move, refocus: boolean) => void;
  commit: (rowId: string, columnId: string, value: CellValue) => void;
  toggle: (rowId: string, columnId: string) => void;
  /** Returns true when the text was a multi-cell range and was handled. html carries the spreadsheet's styling, when there is any. */
  pasteGrid: (text: string, html: string, pos: Pos) => boolean;
  deleteRow: (rowId: string) => void;
  flush: () => void;
};

/* Editing a text or number cell (after a double-click, Enter/F2, or typing).
   The draft only commits on Enter, Tab or leaving the cell -- setCell coerces,
   so a half-typed "1." must not be nulled mid-keystroke. Escape throws it
   away. An unparseable number stays flagged on Enter and is dropped on blur. */
function TextEditor({ start, numeric, format, onExit, onGridPaste, flush }: { start: string; numeric: boolean; format?: CellFormat; onExit: (value: string | undefined, move: Move, refocus: boolean) => void; onGridPaste: (text: string, html: string) => boolean; flush: () => void }) {
  const [draft, setDraft] = useState(start);
  const draftRef = useRef(start);
  const done = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInvalid = (text: string) => numeric && text.trim() !== "" && coerceCell(text, "number") === null;
  const invalid = isInvalid(draft);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  function exit(save: boolean, move: Move, refocus: boolean) {
    if (done.current) return;
    const text = draftRef.current;
    if (save && move !== "none" && isInvalid(text)) return; // keep the draft and the flag
    done.current = true;
    onExit(save && !isInvalid(text) ? text : undefined, move, refocus);
  }

  // Leaving the page mid-edit: keep what was typed and save right away.
  const exitRef = useRef(exit);
  useLayoutEffect(() => {
    exitRef.current = exit;
  });
  useEffect(() => {
    const onHide = () => {
      exitRef.current(true, "none", false);
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={numeric ? "decimal" : undefined}
      value={draft}
      title={invalid ? "Enter a number" : undefined}
      aria-invalid={invalid || undefined}
      style={formatStyle(format)}
      onChange={(e) => {
        draftRef.current = e.target.value;
        setDraft(e.target.value);
      }}
      // Switching to another window blurs the input too; stay in edit mode then, as Excel does.
      onBlur={() => {
        if (document.hasFocus()) exit(true, "none", false);
      }}
      onPaste={(e) => {
        if (!onGridPaste(e.clipboardData.getData("text/plain"), e.clipboardData.getData("text/html"))) return;
        e.preventDefault();
        done.current = true;
        onExit(undefined, "none", true);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          if (e.nativeEvent.isComposing) return;
          e.preventDefault();
          exit(true, "down", true);
        } else if (e.key === "Tab") {
          e.preventDefault();
          exit(true, "right", true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          exit(false, "none", true);
        }
      }}
      className={`${EDITOR} ${numeric ? "text-right tabular-nums" : ""} ${invalid ? "bg-destructive/10" : ""}`}
    />
  );
}

/* Editing a date or dropdown cell: the native control, opened straight away where the browser allows it. */
function PickerEditor({ column, value, onCommit, onExit }: { column: TableColumn; value: string; onCommit: (value: string) => void; onExit: (move: Move, refocus: boolean) => void }) {
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const done = useRef(false);
  const exit = (move: Move, refocus: boolean) => {
    if (done.current) return;
    done.current = true;
    onExit(move, refocus);
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    try {
      el.showPicker?.();
    } catch {
      // Not every browser lets a page open the picker; the focused control still works.
    }
  }, []);
  const keys = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      exit("down", true);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      exit(e.key === "Tab" ? "right" : "none", true);
    }
  };
  if (column.type === "date") {
    return <input ref={ref} type="date" defaultValue={value} onChange={(e) => onCommit(e.target.value)} onBlur={() => document.hasFocus() && exit("none", false)} onKeyDown={keys} className={`${EDITOR} [color-scheme:light_dark]`} />;
  }
  return (
    <select
      ref={ref}
      defaultValue={value}
      onChange={(e) => {
        onCommit(e.target.value);
        exit("none", true);
      }}
      onBlur={() => document.hasFocus() && exit("none", false)}
      onKeyDown={keys}
      className={EDITOR}
    >
      <option value="">—</option>
      {(column.options ?? []).map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

type RowProps = {
  row: TableRow;
  pos: number;
  rowNumber: number;
  columns: TableColumn[];
  api: TableApi;
  /** Formula results and highlights for this row, as JSON text so the memo compares by value. */
  computedJson: string;
  fillsJson: string;
  formatsJson: string;
  /** Selected column span in this row (-1 when the row isn't in the selection). */
  selFrom: number;
  selTo: number;
  /** The active cell's column when it is in this row, else -1. */
  activeCol: number;
  editCol: number;
  editInitial: string | null;
  /** Row 1 marked as a header: shown bold. */
  isHeader: boolean;
  /** How far from the top a frozen row sticks (-1: not frozen), and whether it is the last frozen row. */
  stickyTop: number;
  frozenEdge: boolean;
  /** How many of the first columns are frozen. */
  freezeCols: number;
};

/* One body row. Memoized: it only re-renders when its own row, position,
   formulas, highlights or selection change. */
const TableRowView = memo(function TableRowView({ row, pos, rowNumber, columns, api, computedJson, fillsJson, formatsJson, selFrom, selTo, activeCol, editCol, editInitial, isHeader, stickyTop, frozenEdge, freezeCols }: RowProps) {
  const computed: Record<string, string> = computedJson ? JSON.parse(computedJson) : {};
  const fills: Record<string, string> = fillsJson ? JSON.parse(fillsJson) : {};
  const formats: Record<string, CellFormat> = formatsJson ? JSON.parse(formatsJson) : {};
  const rowSelected = selFrom >= 0;
  const multi = selFrom !== selTo || activeCol < 0; // this row is part of a range, not just the one active cell
  return (
    <tr className="group/row">
      <th
        scope="row"
        onMouseDown={(e) => api.rowMouseDown(e, pos)}
        title="Select this row"
        // Sticky cells need an opaque background, so the selection tint is layered over the header gray.
        style={{ ...(rowSelected ? { backgroundImage: SELECTED_TINT } : {}), ...(stickyTop >= 0 ? { top: stickyTop } : {}) }}
        className={`sticky left-0 ${stickyTop >= 0 ? "z-[8]" : "z-[6]"} cursor-pointer select-none border-b border-r border-sheet-grid bg-sheet-head p-0 text-xs text-sheet-head-foreground ${frozenEdge ? "border-b-2 border-b-sheet-freeze" : ""} ${rowSelected ? "font-semibold" : "font-normal"}`}
      >
        <div className="relative flex h-8 items-center justify-between pl-2 pr-1">
          <span className="tabular-nums">{rowNumber}</span>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => api.deleteRow(row.id)}
            title={`Delete row ${rowNumber}`}
            aria-label={`Delete row ${rowNumber}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </th>
      {columns.map((column, c) => {
        const raw = cellOf(row, column.id);
        const editing = c === editCol && column.type !== "checkbox";
        const result = computed[column.id];
        const isError = result !== undefined && result.startsWith("#");
        let body: ReactNode;
        if (editing && (column.type === "text" || column.type === "number")) {
          body = (
            <TextEditor
              start={editInitial ?? (raw === null || raw === undefined ? "" : String(raw))}
              numeric={column.type === "number"}
              format={formats[column.id]}
              onExit={(value, move, refocus) => api.finishEdit(row.id, column.id, value, move, refocus)}
              onGridPaste={(text, html) => api.pasteGrid(text, html, { r: pos, c })}
              flush={api.flush}
            />
          );
        } else if (editing) {
          body = (
            <PickerEditor
              column={column}
              value={typeof raw === "string" ? raw : ""}
              onCommit={(value) => api.commit(row.id, column.id, value === "" ? null : value)}
              onExit={(move, refocus) => api.finishEdit(row.id, column.id, undefined, move, refocus)}
            />
          );
        } else if (column.type === "checkbox") {
          body = (
            <div className="flex h-8 items-center justify-center">
              <input
                type="checkbox"
                tabIndex={-1}
                checked={raw === true}
                onChange={() => api.toggle(row.id, column.id)}
                aria-label={`${column.name}, row ${rowNumber}`}
                className="h-4 w-4 cursor-pointer accent-ring"
              />
            </div>
          );
        } else {
          const text = displayText(raw, column, result);
          const right = column.type === "number" || (result !== undefined && !isError);
          body = (
            <div title={isFormula(raw) ? String(raw) : text || undefined} style={formatStyle(formats[column.id])} className={`h-8 truncate px-2 leading-8 ${right ? "text-right tabular-nums" : ""} ${isError ? "text-destructive" : ""}`}>
              {text}
            </div>
          );
        }
        const style: CSSProperties = {};
        const fill = fills[column.id];
        if (fill) {
          style.backgroundColor = fill;
          if (!isError) style.color = "#1a1a1a";
        }
        if (rowSelected && c >= selFrom && c <= selTo && !editing && (multi || c !== activeCol)) style.backgroundImage = RANGE_TINT;
        const shadows: string[] = [];
        if (c === activeCol || editing) shadows.push("inset 0 0 0 2px var(--ring)");
        for (const side of formats[column.id]?.border ?? "") if (SIDE_SHADOW[side]) shadows.push(SIDE_SHADOW[side]);
        if (shadows.length > 0) style.boxShadow = shadows.join(", ");
        const frozenCol = c < freezeCols;
        if (stickyTop >= 0) style.top = stickyTop;
        if (frozenCol) style.left = GUTTER_WIDTH + c * COLUMN_WIDTH;
        const frozen = stickyTop >= 0 || frozenCol;
        const frozenClass = frozen ? `sticky bg-sheet-cell ${stickyTop >= 0 && frozenCol ? "z-[5]" : stickyTop >= 0 ? "z-[4]" : "z-[3]"}` : "";
        return (
          <td
            key={column.id}
            data-pos={`${pos}:${c}`}
            onMouseDown={editing ? undefined : (e) => api.cellMouseDown(e, { r: pos, c })}
            onMouseEnter={() => api.cellMouseEnter({ r: pos, c })}
            onDoubleClick={editing ? undefined : () => api.startEdit({ r: pos, c }, null)}
            style={style}
            className={`overflow-hidden border-b border-r border-sheet-grid p-0 ${editing ? "" : "cursor-cell select-none"} ${frozenClass} ${frozenEdge ? "border-b-2 border-b-sheet-freeze" : ""} ${c === freezeCols - 1 ? "border-r-2 border-r-sheet-freeze" : ""} ${isHeader ? "font-semibold" : ""}`}
          >
            {body}
          </td>
        );
      })}
      <td className="border-b border-sheet-grid" />
    </tr>
  );
});

/* The formula bar: the selected cell's address and its content as typed
   (a formula shows as its formula, not its result), editable in place. Enter
   or leaving the box saves; Escape puts it back. */
function FormulaBar({ reference, value, disabled, onCommit, onDone }: { reference: string; value: string; disabled: boolean; onCommit: (value: string) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(value);
  const done = useRef(false);
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-sheet-grid bg-sheet-bar px-1.5 py-1">
      <span className="w-20 shrink-0 truncate rounded border border-sheet-grid px-2 py-0.5 text-center font-mono text-xs text-muted-foreground" title="Selected cell">
        {reference || "—"}
      </span>
      <span className="shrink-0 font-serif text-sm italic text-muted-foreground" aria-hidden>
        fx
      </span>
      <input
        type="text"
        value={draft}
        disabled={disabled}
        aria-label={reference ? `Contents of ${reference}` : "Cell contents"}
        placeholder={disabled ? "Select a cell" : ""}
        onChange={(e) => {
          done.current = false;
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (!done.current && draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            done.current = true;
            if (draft !== value) onCommit(draft);
            onDone();
          } else if (e.key === "Escape") {
            e.preventDefault();
            done.current = true;
            setDraft(value);
            onDone();
          }
        }}
        className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 font-mono text-sm text-foreground outline-none focus:border-sheet-grid focus:bg-sheet-cell disabled:cursor-not-allowed"
      />
    </div>
  );
}

/* Change-type panel shown inside the column's kebab menu. Choosing a radio
   only selects it; nothing changes until Apply. */
function TypePanel({ column, onApply, close }: { column: TableColumn; onApply: (type: ColumnType, options?: string[]) => void; close: () => void }) {
  const [choice, setChoice] = useState<ColumnType>(column.type);
  const [optionsText, setOptionsText] = useState((column.options ?? []).join(", "));

  function apply() {
    if (choice === "dropdown") {
      const seen = new Set<string>();
      const options: string[] = [];
      for (const part of optionsText.split(",")) {
        const option = part.trim().slice(0, 60);
        const key = option.toLowerCase();
        if (!option || seen.has(key)) continue; // blanks and case-insensitive repeats: keep the first spelling
        seen.add(key);
        options.push(option);
      }
      onApply("dropdown", options.slice(0, 100));
    } else {
      onApply(choice);
    }
    close();
  }

  return (
    <div className="w-52 space-y-2">
      <div role="radiogroup" aria-label="Column type" className="space-y-0.5">
        {TYPES.map((type) => (
          <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-ring/10 focus-within:ring-2 focus-within:ring-ring/40 ${choice === type ? "bg-ring/10 font-medium text-ring" : ""}`}>
            <input type="radio" name={`column-type-${column.id}`} checked={choice === type} onChange={() => setChoice(type)} className="sr-only" />
            {TYPE_META[type].icon}
            {TYPE_META[type].label}
          </label>
        ))}
      </div>
      {choice === "dropdown" && (
        <div className="space-y-1.5">
          <label className="block text-xs text-muted-foreground" htmlFor={`options-${column.id}`}>
            Options, separated by commas
          </label>
          <input
            id={`options-${column.id}`}
            type="text"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="Open, In progress, Done"
            autoFocus
            className="h-8 w-full rounded-lg border border-ring/30 bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      )}
      <button
        type="button"
        onClick={apply}
        disabled={choice === column.type && choice !== "dropdown"}
        className="w-full rounded-lg bg-ring/15 px-2 py-1 text-sm font-medium text-ring transition-colors hover:bg-ring/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ring/15"
      >
        Apply
      </button>
    </div>
  );
}

function confirmClear(count: number): boolean {
  return count === 0 || window.confirm(`${count} value${count === 1 ? "" : "s"} in this column will be cleared. Continue?`);
}

type Props = {
  content: TableContent;
  /** Every edit, as the new table and as the operations that produced it
   *  (My Workspace saves the table; the shared Spreadsheets page sends the operations). */
  onChange: (next: TableContent, ops: SheetOp[]) => void;
  /** Save right now instead of waiting for the canvas's debounce. */
  onFlush?: () => void;
  /** The frame is a stacked card (no fixed height): the grid caps its own height. */
  mobile?: boolean;
};

/* The editable grid body of a table block, behaving like a spreadsheet: a
   click selects a cell (drag or Shift+click selects a range, the row number
   or column name selects a whole row or column), a double-click, Enter, F2 or
   simply typing edits it. Arrow keys move, Delete clears, Ctrl+C / Ctrl+X /
   Ctrl+V copy, cut and paste. The highlight swatches apply to the selection.

   Every mutation goes through the pure helpers in lib/workspace.ts; the
   whole table is one payload.

   PERFORMANCE. The block is memoized on `content` and `mobile` only (the
   canvas hands over a fresh onChange arrow every render, so that prop is
   ignored for comparison -- the latest one is kept in a ref). Rows are
   memoized on primitive props, so moving the selection re-renders only the
   rows it enters or leaves. */
function TableBlockImpl({ content, onChange, onFlush, mobile = false }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  /* Undo/redo: each entry holds an edit and the operations that reverse it
     (lib/sheet-ops.ts), so undoing only touches what that edit changed --
     in a shared spreadsheet it never rolls back other people's edits. */
  const undoStack = useRef<{ undo: SheetOp[]; redo: SheetOp[] }[]>([]);
  const redoStack = useRef<{ undo: SheetOp[]; redo: SheetOp[] }[]>([]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [renameDraft, setRenameDraft] = useState("");
  const [sort, setSort] = useState<{ columnId: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState("");
  // Per-column filters: the values (as shown) each filtered column may have. View only, never saved.
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const renameCancelled = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // An invisible text box holds the keyboard focus while cells are selected, so
  // typing, copy and paste reach the table in every browser.
  const keyRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  const onFlushRef = useRef(onFlush);
  // Original row positions in the order they are shown.
  const viewRef = useRef<number[]>([]);
  const viewActiveRef = useRef(false);
  const selectionRef = useRef<Selection | null>(null);
  const dragging = useRef(false);
  const pointerType = useRef("mouse");
  useLayoutEffect(() => {
    contentRef.current = content;
    onChangeRef.current = onChange;
    onFlushRef.current = onFlush;
  });

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const [api] = useState(() => {
    /* Two changes in one tick must build on each other, so the ref moves
       forward immediately instead of waiting for the re-render. */
    const emit = (ops: SheetOp[], record = true) => {
      if (ops.length === 0) return;
      const before = contentRef.current;
      const next = applySheetOps(before, ops);
      if (record) {
        const undo = invertSheetOps(before, ops);
        if (undo.length > 0) {
          undoStack.current.push({ undo, redo: ops });
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
          redoStack.current = [];
          setHistory({ canUndo: true, canRedo: false });
        }
      }
      contentRef.current = next;
      onChangeRef.current(next, ops);
    };
    const select = (anchor: Pos, focus: Pos = anchor) => {
      selectionRef.current = { anchor, focus };
      setSelection({ anchor, focus });
      setMessage(null);
    };
    const focusGrid = () => keyRef.current?.focus({ preventScroll: true });
    const cellAt = (pos: Pos) => {
      const current = contentRef.current;
      const row = current.rows[viewRef.current[pos.r]];
      const column = current.columns[pos.c];
      return row && column ? { row, column } : null;
    };
    const api: TableApi = {
      run: emit,
      cellMouseDown: (e, pos) => {
        if (e.button !== 0) return;
        e.preventDefault(); // no text selection while dragging, and focus stays on the grid
        focusGrid();
        const current = selectionRef.current;
        if (e.shiftKey && current) {
          select(current.anchor, pos);
          return;
        }
        // On a touch screen there is no double-click: tapping the selected cell again edits it.
        if (pointerType.current === "touch" && current && samePos(current.anchor, pos) && samePos(current.focus, pos)) {
          api.startEdit(pos, null);
          return;
        }
        select(pos);
        dragging.current = true;
      },
      cellMouseEnter: (pos) => {
        const current = selectionRef.current;
        if (dragging.current && current && !samePos(current.focus, pos)) select(current.anchor, pos);
      },
      rowMouseDown: (e, r) => {
        if (e.button !== 0) return;
        e.preventDefault();
        focusGrid();
        const last = contentRef.current.columns.length - 1;
        const current = selectionRef.current;
        if (e.shiftKey && current) select({ r: current.anchor.r, c: 0 }, { r, c: last });
        else select({ r, c: 0 }, { r, c: last });
      },
      startEdit: (pos, initial) => {
        const cell = cellAt(pos);
        if (!cell) return;
        select(pos);
        if (cell.column.type === "checkbox") {
          api.toggle(cell.row.id, cell.column.id);
          return;
        }
        setEditing({ rowId: cell.row.id, colId: cell.column.id, initial });
      },
      finishEdit: (rowId, columnId, value, move, refocus) => {
        const current = contentRef.current;
        const rowIndex = current.rows.findIndex((r) => r.id === rowId);
        const colIndex = current.columns.findIndex((c) => c.id === columnId);
        const ops: SheetOp[] = [];
        if (value !== undefined && rowIndex >= 0 && colIndex >= 0) {
          const column = current.columns[colIndex];
          if (coerceCell(value, column.type, column.options) !== cellOf(current.rows[rowIndex], columnId)) ops.push({ t: "set", cells: [[rowId, columnId, value]] });
        }
        setEditing((e) => (e && e.rowId === rowId && e.colId === columnId ? null : e));
        const view = viewRef.current;
        const r = view.indexOf(rowIndex);
        if (move === "down" && r >= 0) {
          if (r + 1 < view.length) select({ r: r + 1, c: colIndex });
          else if (!viewActiveRef.current && current.rows.length < MAX_ROWS) {
            // Enter on the last row adds a new one, as before.
            ops.push({ t: "addRow", id: newCellId() });
            select({ r: r + 1, c: colIndex });
          }
        } else if (move === "right" && r >= 0 && colIndex + 1 < current.columns.length) {
          select({ r, c: colIndex + 1 });
        }
        emit(ops);
        if (refocus) focusGrid();
      },
      commit: (rowId, columnId, value) => emit([{ t: "set", cells: [[rowId, columnId, value]] }]),
      toggle: (rowId, columnId) => {
        const row = contentRef.current.rows.find((r) => r.id === rowId);
        if (row) emit([{ t: "set", cells: [[rowId, columnId, cellOf(row, columnId) !== true]] }]);
      },
      pasteGrid: (text, html, pos) => {
        // Excel appends one line break to even a single-cell copy; that is not a grid.
        const trimmed = text.replace(/(\r\n|\n)$/, "");
        if (!/[\t\n\r]/.test(trimmed)) return false;
        if (viewActiveRef.current) {
          setMessage("Clear the sort and filter to paste a range.");
          return true;
        }
        const grid = parsePastedGrid(trimmed);
        if (grid.length === 0) return true;
        const startRow = viewRef.current[pos.r] ?? contentRef.current.rows.length;
        const pasted = pasteOps(contentRef.current, startRow, pos.c, grid);
        emit(pasted.ops);
        const next = contentRef.current;
        // The values land at once; the spreadsheet's colors and text styling follow a moment later.
        if (html) {
          void readClipboardTableStyles(html).then((styles) => {
            if (!styles || styles.length !== grid.length) return;
            const cells: [string, string, string | null, CellFormat | null][] = [];
            styles.forEach((line, r) => {
              const rowId = pasted.rowIds[r];
              if (rowId) line.forEach((style, c) => pasted.columnIds[c] && cells.push([rowId, pasted.columnIds[c], style?.fill ?? null, style?.format ?? null]));
            });
            emit([{ t: "style", cells }]);
          });
        }
        const width = Math.max(...grid.map((line) => line.length));
        select(pos, { r: Math.min(next.rows.length - 1, pos.r + grid.length - 1), c: Math.min(next.columns.length - 1, pos.c + width - 1) });
        return true;
      },
      deleteRow: (rowId) => {
        const current = contentRef.current;
        const index = current.rows.findIndex((r) => r.id === rowId);
        if (index < 0) return;
        if (Object.values(current.rows[index].cells).some((v) => v !== null && v !== undefined) && !window.confirm(`Delete row ${index + 1}?`)) return;
        emit([{ t: "removeRow", id: rowId }]);
      },
      flush: () => onFlushRef.current?.(),
    };
    return api;
  });

  /* Applies operations locally and reports them (same as the api's emit, for code outside it). */
  function runOps(ops: SheetOp[]) {
    api.run(ops);
  }

  function undo() {
    const entry = undoStack.current.pop();
    if (!entry) return;
    api.run(entry.undo, false);
    redoStack.current.push(entry);
    setHistory({ canUndo: undoStack.current.length > 0, canRedo: true });
  }

  function redo() {
    const entry = redoStack.current.pop();
    if (!entry) return;
    api.run(entry.redo, false);
    undoStack.current.push(entry);
    setHistory({ canUndo: true, canRedo: redoStack.current.length > 0 });
  }

  /* Column-level actions live beside the api but only ever run from menus. */
  const columnActions = useState(() => ({
    changeType: (columnId: string, type: ColumnType, options?: string[]) => {
      const current = contentRef.current;
      const column = current.columns.find((c) => c.id === columnId);
      if (!column) return;
      const nextOptions = type === "dropdown" ? (options ?? column.options ?? []) : undefined;
      let lost = 0;
      for (const row of current.rows) {
        const raw = cellOf(row, columnId);
        if (raw !== null && coerceCell(raw, type, nextOptions) === null) lost++;
      }
      if (!confirmClear(lost)) return;
      runOps([{ t: "colType", id: columnId, type, ...(options ? { options } : {}) }]);
    },
    deleteColumn: (columnId: string) => {
      const current = contentRef.current;
      const lost = current.rows.filter((r) => cellOf(r, columnId) !== null).length;
      if (!confirmClear(lost)) return;
      runOps([{ t: "removeCol", id: columnId }]);
    },
  }))[0];

  const { columns, rows } = content;

  // Worked-out formula results, keyed by row then column.
  const computedByRow = useMemo(() => {
    const result: Record<string, Record<string, string>> = {};
    if (!rows.some((r) => Object.values(r.cells).some((v) => isFormula(v)))) return result;
    for (const [key, text] of Object.entries(evaluateTable(content))) {
      const [rowId, columnId] = key.split("|");
      (result[rowId] ??= {})[columnId] = text;
    }
    return result;
  }, [content, rows]);

  const fillsByRow = useMemo(() => {
    const result: Record<string, Record<string, string>> = {};
    for (const [key, color] of Object.entries(content.fills ?? {})) {
      const [rowId, columnId] = key.split("|");
      (result[rowId] ??= {})[columnId] = color;
    }
    return result;
  }, [content.fills]);

  const formatsByRow = useMemo(() => {
    const result: Record<string, Record<string, CellFormat>> = {};
    for (const [key, format] of Object.entries(content.formats ?? {})) {
      const [rowId, columnId] = key.split("|");
      (result[rowId] ??= {})[columnId] = format;
    }
    return result;
  }, [content.formats]);

  // Which rows to show, and in what order. This is only a view: the saved table keeps its own order.
  const textOf = useCallback(
    (row: TableRow, columnId: string): string => {
      const shownText = computedByRow[row.id]?.[columnId];
      if (shownText !== undefined) return shownText;
      const raw = cellOf(row, columnId);
      return raw === null || raw === undefined ? "" : String(raw);
    },
    [computedByRow],
  );
  const hasHeader = !!content.header && rows.length > 0;
  const view = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    // A header row (row 1) is always shown first and left out of filtering and sorting.
    let indexes = rows.map((_, i) => i).slice(hasHeader ? 1 : 0);
    if (needle) indexes = indexes.filter((i) => columns.some((c) => textOf(rows[i], c.id).toLowerCase().includes(needle)));
    const active = Object.entries(columnFilters)
      .filter(([columnId]) => columns.some((c) => c.id === columnId))
      .map(([columnId, allowed]) => [columnId, new Set(allowed)] as const);
    if (active.length > 0) indexes = indexes.filter((i) => active.every(([columnId, allowed]) => allowed.has(textOf(rows[i], columnId))));
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      const numeric = (text: string) => text.trim() !== "" && Number.isFinite(Number(text));
      indexes = [...indexes].sort((a, b) => {
        const x = textOf(rows[a], sort.columnId);
        const y = textOf(rows[b], sort.columnId);
        if (x === "" && y === "") return a - b;
        if (x === "") return 1; // blanks always last
        if (y === "") return -1;
        const order = numeric(x) && numeric(y) ? Number(x) - Number(y) : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
        return order === 0 ? a - b : order * dir;
      });
    }
    return hasHeader ? [0, ...indexes] : indexes;
  }, [rows, columns, textOf, filter, sort, columnFilters, hasHeader]);
  const filteredColumns = columns.filter((c) => columnFilters[c.id]).length;
  const viewActive = filter.trim() !== "" || sort !== null || filteredColumns > 0;

  // The selection, kept inside the rows and columns that exist right now.
  const sel = useMemo(() => {
    if (!selection || view.length === 0 || columns.length === 0) return null;
    const clamp = (p: Pos): Pos => ({ r: Math.min(Math.max(p.r, 0), view.length - 1), c: Math.min(Math.max(p.c, 0), columns.length - 1) });
    const anchor = clamp(selection.anchor);
    const focus = clamp(selection.focus);
    return { anchor, focus, r1: Math.min(anchor.r, focus.r), r2: Math.max(anchor.r, focus.r), c1: Math.min(anchor.c, focus.c), c2: Math.max(anchor.c, focus.c) };
  }, [selection, view.length, columns.length]);

  useLayoutEffect(() => {
    viewRef.current = view;
    viewActiveRef.current = viewActive;
    selectionRef.current = sel ? { anchor: sel.anchor, focus: sel.focus } : null;
  });

  // Frozen rows and columns (a header row always counts as frozen), kept within what exists.
  const freezeRows = Math.min(view.length, Math.max(content.freeze?.rows ?? 0, hasHeader ? 1 : 0));
  const freezeCols = Math.min(columns.length, content.freeze?.cols ?? 0);

  // Keep the moving end of the selection on screen (keyboard moves can leave it behind).
  const focusKey = sel ? `${sel.focus.r}:${sel.focus.c}` : "";
  useEffect(() => {
    if (!focusKey) return;
    wrapRef.current?.querySelector(`td[data-pos="${focusKey}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusKey]);

  /* Every [rowId, columnId] inside the selection. */
  function selectedCells(): [string, string][] {
    if (!sel) return [];
    const cells: [string, string][] = [];
    for (let r = sel.r1; r <= sel.r2; r++) {
      const row = rows[view[r]];
      if (!row) continue;
      for (let c = sel.c1; c <= sel.c2; c++) cells.push([row.id, columns[c].id]);
    }
    return cells;
  }

  /* Puts one value (null clears) into every selected cell. */
  function setSelected(value: CellValue) {
    runOps([{ t: "set", cells: selectedCells().map(([r, c]) => [r, c, value] as [string, string, CellValue]) }]);
  }

  function selectionText(): string {
    if (!sel) return "";
    const lines: string[] = [];
    for (let r = sel.r1; r <= sel.r2; r++) {
      const row = rows[view[r]];
      if (!row) continue;
      const values: string[] = [];
      for (let c = sel.c1; c <= sel.c2; c++) {
        const column = columns[c];
        const text = displayText(cellOf(row, column.id), column, computedByRow[row.id]?.[column.id]);
        values.push(/[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
      }
      lines.push(values.join("\t"));
    }
    return lines.join("\n");
  }

  function onGridKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!sel) return;
    const maxR = view.length - 1;
    const maxC = columns.length - 1;
    const set = (anchor: Pos, focus: Pos = anchor) => {
      setSelection({ anchor, focus });
      setMessage(null);
    };
    const move = (dr: number, dc: number, extend: boolean) => {
      e.preventDefault();
      const base = extend ? sel.focus : sel.anchor;
      const next = { r: Math.min(Math.max(base.r + dr, 0), maxR), c: Math.min(Math.max(base.c + dc, 0), maxC) };
      if (extend) set(sel.anchor, next);
      else set(next);
    };
    const mod = e.ctrlKey || e.metaKey;
    const column = columns[sel.anchor.c];
    switch (e.key) {
      case "ArrowUp":
        return move(mod ? -maxR : -1, 0, e.shiftKey);
      case "ArrowDown":
        return move(mod ? maxR : 1, 0, e.shiftKey);
      case "ArrowLeft":
        return move(0, mod ? -maxC : -1, e.shiftKey);
      case "ArrowRight":
        return move(0, mod ? maxC : 1, e.shiftKey);
      case "Tab":
        if ((e.shiftKey && sel.anchor.c === 0) || (!e.shiftKey && sel.anchor.c === maxC)) return; // let focus leave the table
        return move(0, e.shiftKey ? -1 : 1, false);
      case "Enter":
      case "F2":
        e.preventDefault();
        api.startEdit(sel.anchor, null);
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        setSelected(null);
        return;
      case "Escape":
        e.preventDefault();
        set(sel.anchor);
        return;
    }
    if (mod && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      toggleFormat(e.key.toLowerCase() as "b" | "i" | "u");
      return;
    }
    if (mod && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x")) {
      // Put the selection in the hidden box and select it, so the browser's own copy has something to copy.
      const box = keyRef.current;
      if (box) {
        box.value = selectionText();
        box.select();
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      set({ r: 0, c: 0 }, { r: maxR, c: maxC });
      return;
    }
    if (e.key === " " && column?.type === "checkbox") {
      e.preventDefault();
      api.startEdit(sel.anchor, null); // toggles
      return;
    }
    // Typing starts editing the active cell, replacing what was there.
    if (e.key.length === 1 && !mod && !e.altKey && !e.nativeEvent.isComposing && column && column.type !== "checkbox") {
      e.preventDefault();
      api.startEdit(sel.anchor, column.type === "text" || column.type === "number" ? e.key : null);
    }
  }

  function onGridCopy(e: ClipboardEvent<HTMLTextAreaElement>, cut: boolean) {
    if (!sel) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", selectionText());
    if (cut) setSelected(null);
  }

  function onGridPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (!sel) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (api.pasteGrid(text, e.clipboardData.getData("text/html"), sel.anchor)) return;
    // One value goes into every selected cell, as in Excel.
    setSelected(text.replace(/(\r\n|\n)$/, ""));
  }

  function selectColumn(c: number) {
    if (view.length === 0) return;
    keyRef.current?.focus({ preventScroll: true });
    setSelection({ anchor: { r: 0, c }, focus: { r: view.length - 1, c } });
    setMessage(null);
  }

  const atMaxRows = rows.length >= MAX_ROWS;
  const atMaxColumns = columns.length >= MAX_COLUMNS;
  const nearRowLimit = rows.length > MAX_ROWS * 0.9;

  function startRename(column: TableColumn) {
    renameCancelled.current = false;
    setRenameDraft(column.name);
    setRenamingId(column.id);
  }

  function finishRename(column: TableColumn) {
    if (renamingId !== column.id) return;
    setRenamingId(null);
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    if (renameDraft.trim() && renameDraft.trim() !== column.name) {
      runOps([{ t: "renameCol", id: column.id, name: renameDraft.trim() }]);
    }
  }

  function menuItems(column: TableColumn): KebabMenuItem[] {
    const onlyColumn = columns.length <= 1;
    return [
      { label: "Rename", onClick: () => startRename(column) },
      {
        label: "Change type",
        panel: (close) => <TypePanel column={column} onApply={(type, options) => columnActions.changeType(column.id, type, options)} close={close} />,
      },
      onlyColumn
        ? { label: "Delete column", destructive: true, panel: () => <p className="w-48 text-sm text-muted-foreground">A table needs at least one column, so this one can&apos;t be deleted.</p> }
        : { label: "Delete column", destructive: true, onClick: () => columnActions.deleteColumn(column.id) },
    ];
  }

  function highlight(color: string | null) {
    runOps([{ t: "fill", cells: selectedCells(), color }]);
  }

  // The toolbar shows the active cell's styling; a toggle applies to the whole selection.
  const activeFormat: CellFormat = sel ? (formatsByRow[rows[view[sel.anchor.r]]?.id ?? ""]?.[columns[sel.anchor.c]?.id ?? ""] ?? {}) : {};

  function format(patch: FormatPatch) {
    runOps([{ t: "format", cells: selectedCells(), patch }]);
  }

  function toggleFormat(flag: "b" | "i" | "u") {
    format({ [flag]: !activeFormat[flag] });
  }

  const activeFill = sel ? fillsByRow[rows[view[sel.anchor.r]]?.id ?? ""]?.[columns[sel.anchor.c]?.id ?? ""] : undefined;

  function setAlign(align: CellAlign) {
    format({ align: activeFormat.align === align ? null : align });
  }

  /* Borders for the selection. "All" draws each cell's top and left plus the
     range's right and bottom edge, so shared edges are drawn once. */
  function applyBorders(choice: BorderChoice) {
    if (!sel) return;
    if (choice === "none") {
      runOps([{ t: "format", cells: selectedCells(), patch: { borderOff: "trbl" } }]);
      return;
    }
    const groups = new Map<string, [string, string][]>();
    for (let r = sel.r1; r <= sel.r2; r++) {
      const row = rows[view[r]];
      if (!row) continue;
      for (let c = sel.c1; c <= sel.c2; c++) {
        const top = r === sel.r1, bottom = r === sel.r2, left = c === sel.c1, right = c === sel.c2;
        let on = "";
        if (choice === "all") on = `t${right ? "r" : ""}${bottom ? "b" : ""}l`;
        else if (choice === "outside") on = `${top ? "t" : ""}${right ? "r" : ""}${bottom ? "b" : ""}${left ? "l" : ""}`;
        else if (choice === "top" && top) on = "t";
        else if (choice === "bottom" && bottom) on = "b";
        else if (choice === "left" && left) on = "l";
        else if (choice === "right" && right) on = "r";
        if (!on) continue;
        const list = groups.get(on) ?? [];
        list.push([row.id, columns[c].id]);
        groups.set(on, list);
      }
    }
    runOps([...groups].map(([on, cells]) => ({ t: "format" as const, cells, patch: { borderOn: on } })));
  }

  /* Every distinct value in a column (as shown), for its filter list. */
  function columnValues(columnId: string): string[] {
    const seen = new Set<string>();
    for (const row of hasHeader ? rows.slice(1) : rows) seen.add(textOf(row, columnId));
    return [...seen].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  }

  /* Row 1's values become the column names (blank ones keep their name) and the row goes. */
  function firstRowToNames() {
    const first = rows[0];
    if (!first) return;
    const ops: SheetOp[] = [];
    for (const column of columns) {
      const name = textOf(first, column.id).trim();
      if (name && name !== column.name) ops.push({ t: "renameCol", id: column.id, name });
    }
    ops.push({ t: "removeRow", id: first.id });
    if (content.header) ops.push({ t: "header", on: false });
    runOps(ops);
  }

  function sortFilterItems(column: TableColumn): KebabMenuItem[] {
    const sorted = sort?.columnId === column.id;
    const filtered = !!columnFilters[column.id];
    // Choosing the sort that's already on turns it off.
    const sortItem = (dir: "asc" | "desc", label: string): KebabMenuItem => {
      const on = sorted && sort?.dir === dir;
      return { label: `${on ? "✓ " : ""}${label}`, onClick: () => setSort(on ? null : { columnId: column.id, dir }) };
    };
    return [
      sortItem("asc", "Sort A → Z"),
      sortItem("desc", "Sort Z → A"),
      {
        label: hasHeader ? "✓ Row 1 is a header" : "Row 1 is a header (keep it on top)",
        onClick: () => runOps([{ t: "header", on: !hasHeader }]),
      },
      ...(rows.length > 0 ? [{ label: "Use row 1 as column names", onClick: firstRowToNames }] : []),
      {
        label: filtered ? "Change filter…" : "Filter by values…",
        panel: (close) => (
          <FilterPanel
            values={columnValues(column.id)}
            selected={columnFilters[column.id] ?? null}
            close={close}
            onApply={(allowed) =>
              setColumnFilters((prev) => {
                const next = { ...prev };
                if (allowed) next[column.id] = allowed;
                else delete next[column.id];
                return next;
              })
            }
          />
        ),
      },
      ...(filtered
        ? [
            {
              label: "Clear filter",
              onClick: () =>
                setColumnFilters((prev) => {
                  const next = { ...prev };
                  delete next[column.id];
                  return next;
                }),
            },
          ]
        : []),
    ];
  }

  function freeze(rows: number, cols: number) {
    runOps([{ t: "freeze", rows, cols }]);
  }

  // The active cell, for the formula bar.
  const activeRow = sel ? rows[view[sel.anchor.r]] : undefined;
  const activeColumn = sel ? columns[sel.anchor.c] : undefined;
  const activeRef = activeRow && activeColumn ? `${columnName(sel!.anchor.c)}${view[sel!.anchor.r] + 1}` : "";
  const activeRaw = activeRow && activeColumn ? cellOf(activeRow, activeColumn.id) : null;
  const activeText = activeRaw === null || activeRaw === undefined ? "" : activeRaw === true ? "TRUE" : activeRaw === false ? "FALSE" : String(activeRaw);
  const rangeLabel = sel && (sel.r1 !== sel.r2 || sel.c1 !== sel.c2) ? `${columnName(sel.c1)}${view[sel.r1] + 1}:${columnName(sel.c2)}${view[sel.r2] + 1}` : activeRef;

  function commitFormulaBar(value: string) {
    if (!activeRow || !activeColumn) return;
    if (coerceCell(value, activeColumn.type, activeColumn.options) === activeRaw) return;
    runOps([{ t: "set", cells: [[activeRow.id, activeColumn.id, value]] }]);
  }

  const toolButton = (active: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-ring/20 text-ring" : "text-muted-foreground hover:bg-ring/10 hover:text-foreground"}`;
  const toolSelect = "h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40";

  const tableWidth = GUTTER_WIDTH + columns.length * COLUMN_WIDTH + ADD_COLUMN_WIDTH;
  const headerCell = "sticky top-0 z-10 border-b border-r border-sheet-grid bg-sheet-head text-sheet-head-foreground";
  const selectedCount = sel ? (sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1) : 0;

  return (
    <div className={`relative flex min-h-0 flex-col ${mobile ? "max-h-[65vh]" : "h-full"}`}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-sheet-grid bg-sheet-bar px-1.5 py-1" role="toolbar" aria-label="Format the selected cells">
        <button type="button" disabled={!history.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" onMouseDown={(e) => e.preventDefault()} onClick={undo} className={toolButton(false)}>
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={!history.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo" onMouseDown={(e) => e.preventDefault()} onClick={redo} className={toolButton(false)}>
          <Redo2 className="h-3.5 w-3.5" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        <button type="button" disabled={!sel} title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={!!activeFormat.b} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleFormat("b")} className={toolButton(!!activeFormat.b)}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={!sel} title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={!!activeFormat.i} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleFormat("i")} className={toolButton(!!activeFormat.i)}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={!sel} title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={!!activeFormat.u} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleFormat("u")} className={toolButton(!!activeFormat.u)}>
          <Underline className="h-3.5 w-3.5" />
        </button>
        <select
          disabled={!sel}
          aria-label="Font"
          title="Font"
          value={activeFormat.font ?? ""}
          onChange={(e) => {
            format({ font: (e.target.value || null) as CellFont | null });
            keyRef.current?.focus({ preventScroll: true });
          }}
          className={toolSelect}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          disabled={!sel}
          aria-label="Text size"
          title="Text size"
          value={activeFormat.size ?? ""}
          onChange={(e) => {
            format({ size: (e.target.value || null) as CellSize | null });
            keyRef.current?.focus({ preventScroll: true });
          }}
          className={toolSelect}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        {ALIGN_CHOICES.map((a) => (
          <button key={a.value} type="button" disabled={!sel} title={a.label} aria-label={a.label} aria-pressed={activeFormat.align === a.value} onMouseDown={(e) => e.preventDefault()} onClick={() => setAlign(a.value)} className={toolButton(activeFormat.align === a.value)}>
            {a.icon}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        <KebabMenu
          ariaLabel="Text color"
          title="Text color"
          disabled={!sel}
          icon={
            <span className="flex flex-col items-center leading-none">
              <Baseline className="h-3.5 w-3.5" />
              <span className="mt-0.5 h-1 w-4 rounded-sm border border-border" style={{ backgroundColor: activeFormat.color ?? "transparent" }} />
            </span>
          }
          content={(close) => <SwatchPanel colors={TEXT_COLORS} noneLabel="Automatic" current={activeFormat.color} close={close} onPick={(color) => format({ color })} />}
        />
        <KebabMenu
          ariaLabel="Highlight color"
          title={sel ? `Highlight ${selectedCount === 1 ? "the cell" : `${selectedCount} cells`}` : "Highlight"}
          disabled={!sel}
          icon={
            <span className="flex flex-col items-center leading-none">
              <PaintBucket className="h-3.5 w-3.5" />
              <span className="mt-0.5 h-1 w-4 rounded-sm border border-border" style={{ backgroundColor: activeFill ?? "transparent" }} />
            </span>
          }
          content={(close) => <SwatchPanel colors={FILL_COLORS} noneLabel="No highlight" current={activeFill} close={close} onPick={(color) => highlight(color)} />}
        />
        <KebabMenu
          ariaLabel="Borders"
          title="Borders"
          disabled={!sel}
          icon={<Grid2x2 className="h-3.5 w-3.5" />}
          content={(close) => (
            <div className="w-44">
              {BORDER_CHOICES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyBorders(b.value);
                    close();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-ring/10"
                >
                  <span className="text-muted-foreground">{b.icon}</span>
                  {b.label}
                </button>
              ))}
            </div>
          )}
        />
        <KebabMenu
          ariaLabel="Freeze rows and columns"
          title="Freeze rows and columns"
          active={freezeRows > (hasHeader ? 1 : 0) || freezeCols > 0}
          icon={<Snowflake className="h-3.5 w-3.5" />}
          content={(close) => {
            const upToRow = sel ? Math.min(MAX_FREEZE_ROWS, sel.anchor.r + 1) : 0;
            const upToCol = sel ? Math.min(MAX_FREEZE_COLS, sel.anchor.c + 1) : 0;
            const rowChoices = [0, 1, 2, ...(upToRow > 2 ? [upToRow] : [])];
            const colChoices = [0, 1, 2, ...(upToCol > 2 ? [upToCol] : [])];
            const option = (label: string, on: boolean, pick: () => void) => (
              <button
                key={label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  pick();
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-ring/10"
              >
                <span className="w-3 text-ring">{on ? "✓" : ""}</span>
                {label}
              </button>
            );
            const rowsNow = content.freeze?.rows ?? 0;
            const colsNow = content.freeze?.cols ?? 0;
            return (
              <div className="w-52 space-y-2">
                <div>
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rows</p>
                  {rowChoices.map((n) => option(n === 0 ? "No rows" : n === upToRow && n > 2 ? `Up to row ${n}` : `${n} row${n === 1 ? "" : "s"}`, rowsNow === n, () => freeze(n, colsNow)))}
                </div>
                <div>
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</p>
                  {colChoices.map((n) => option(n === 0 ? "No columns" : n === upToCol && n > 2 ? `Up to column ${columnName(n - 1)}` : `${n} column${n === 1 ? "" : "s"}`, colsNow === n, () => freeze(rowsNow, n)))}
                </div>
                {hasHeader && <p className="px-2 text-xs text-muted-foreground">Row 1 is a header, so it always stays on top.</p>}
              </div>
            );
          }}
        />
      </div>
      <FormulaBar key={`${activeRow?.id ?? ""}|${activeColumn?.id ?? ""}|${activeText}`} reference={rangeLabel} value={activeText} disabled={!activeRow || !activeColumn} onCommit={commitFormulaBar} onDone={() => keyRef.current?.focus({ preventScroll: true })} />
      <textarea
        ref={keyRef}
        aria-label="Selected cells. Type to edit, arrow keys to move."
        className="pointer-events-none absolute left-0 top-0 h-px w-px resize-none overflow-hidden opacity-0"
        tabIndex={0}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          // Tabbing into the table selects its first cell.
          if (!selectionRef.current && view.length > 0 && columns.length > 0) setSelection({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
        }}
        onInput={(e) => {
          e.currentTarget.value = ""; // anything typed here is handled as a key press instead
        }}
        onKeyDown={onGridKeyDown}
        onCopy={(e) => onGridCopy(e, false)}
        onCut={(e) => onGridCopy(e, true)}
        onPaste={onGridPaste}
      />
      <div
        ref={wrapRef}
        role="grid"
        aria-label="Table"
        aria-multiselectable
        className="min-h-0 flex-1 overflow-auto outline-none"
        onPointerDownCapture={(e) => {
          pointerType.current = e.pointerType;
        }}
      >
        <table className="border-separate border-spacing-0 text-sm" style={{ width: tableWidth, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: GUTTER_WIDTH }} />
            {columns.map((c) => (
              <col key={c.id} style={{ width: COLUMN_WIDTH }} />
            ))}
            <col style={{ width: ADD_COLUMN_WIDTH }} />
          </colgroup>
          <thead>
            <tr>
              <th
                className={`${headerCell} left-0 z-20 cursor-pointer`}
                title="Select all"
                aria-label="Select all"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (view.length === 0) return;
                  keyRef.current?.focus({ preventScroll: true });
                  setSelection({ anchor: { r: 0, c: 0 }, focus: { r: view.length - 1, c: columns.length - 1 } });
                }}
              />
              {columns.map((column, c) => {
                const columnSelected = !!sel && c >= sel.c1 && c <= sel.c2;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={{ ...(columnSelected ? { backgroundImage: SELECTED_TINT } : {}), ...(c < freezeCols ? { left: GUTTER_WIDTH + c * COLUMN_WIDTH } : {}) }}
                    className={`${headerCell} p-0 text-left font-medium ${c < freezeCols ? "z-[15]" : ""} ${c === freezeCols - 1 ? "border-r-2 border-r-sheet-freeze" : ""}`}
                  >
                    <div className="flex h-9 items-center gap-1 pl-2 pr-0.5">
                      {renamingId === column.id ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          maxLength={60}
                          aria-label="Column name"
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => finishRename(column)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              renameCancelled.current = true;
                              e.currentTarget.blur();
                            }
                          }}
                          className="h-7 min-w-0 flex-1 rounded-md border border-ring/40 bg-background px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        />
                      ) : (
                        <>
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ring/15 text-ring"
                            title={TYPE_META[column.type].label}
                            aria-label={`Type: ${TYPE_META[column.type].label}`}
                          >
                            {TYPE_META[column.type].icon}
                          </span>
                          <span
                            className="min-w-0 flex-1 cursor-pointer select-none truncate"
                            title={`${column.name} (click to select the column, double-click to rename)`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectColumn(c);
                            }}
                            onDoubleClick={() => startRename(column)}
                          >
                            {column.name}
                          </span>
                          {sort?.columnId === column.id && (
                            <span className="shrink-0 text-ring" title={sort.dir === "asc" ? "Sorted A to Z" : "Sorted Z to A"}>
                              {sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
                            </span>
                          )}
                        </>
                      )}
                      <KebabMenu
                        items={sortFilterItems(column)}
                        ariaLabel={`Sort or filter column ${column.name}`}
                        title="Sort and filter"
                        active={!!columnFilters[column.id]}
                        icon={<ListFilter className="h-3.5 w-3.5" />}
                      />
                      <KebabMenu items={menuItems(column)} ariaLabel={`Options for column ${column.name}`} />
                    </div>
                  </th>
                );
              })}
              <th className={`${headerCell} p-0`}>
                <button
                  type="button"
                  disabled={atMaxColumns}
                  title={atMaxColumns ? `A table can have at most ${MAX_COLUMNS} columns.` : "Add a column"}
                  aria-label="Add a column"
                  onClick={() => {
                    runOps([{ t: "addCol", id: newCellId() }]);
                  }}
                  className="flex h-9 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-ring/15 hover:text-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {view.map((rowIndex, pos) => {
              const row = rows[rowIndex];
              const computed = computedByRow[row.id];
              const fills = fillsByRow[row.id];
              const formats = formatsByRow[row.id];
              const inSel = !!sel && pos >= sel.r1 && pos <= sel.r2;
              const editCol = editing && editing.rowId === row.id ? columns.findIndex((c) => c.id === editing.colId) : -1;
              return (
                <TableRowView
                  key={row.id}
                  row={row}
                  pos={pos}
                  rowNumber={rowIndex + 1}
                  columns={columns}
                  api={api}
                  computedJson={computed ? JSON.stringify(computed) : ""}
                  fillsJson={fills ? JSON.stringify(fills) : ""}
                  formatsJson={formats ? JSON.stringify(formats) : ""}
                  selFrom={inSel ? sel.c1 : -1}
                  selTo={inSel ? sel.c2 : -1}
                  activeCol={sel && sel.anchor.r === pos ? sel.anchor.c : -1}
                  editCol={editCol}
                  editInitial={editCol >= 0 ? editing!.initial : null}
                  isHeader={hasHeader && rowIndex === 0}
                  stickyTop={pos < freezeRows ? HEAD_ROW_HEIGHT + pos * BODY_ROW_HEIGHT : -1}
                  frozenEdge={pos === freezeRows - 1}
                  freezeCols={freezeCols}
                />
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No rows yet. Use “Row” below.</p>}
        {rows.length > 0 && view.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No rows match “{filter}”.</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-sheet-grid bg-sheet-bar px-2 py-1">
        <button
          type="button"
          disabled={atMaxRows}
          title={atMaxRows ? `A table can have at most ${MAX_ROWS.toLocaleString("en-US")} rows.` : "Add a row"}
          onClick={() => {
            setFilter(""); // a new blank row would not match the filter
            runOps([{ t: "addRow", id: newCellId() }]);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ring transition-colors hover:bg-ring/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" /> Row
        </button>
        {viewActive && (
          <button
            type="button"
            onClick={() => {
              setFilter("");
              setSort(null);
              setColumnFilters({});
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-ring transition-colors hover:bg-ring/15"
          >
            Clear sort and filters
          </button>
        )}
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows…"
          aria-label="Filter rows"
          className="h-6 w-32 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        {message ? (
          <span role="status" className="text-xs font-medium text-status-warning-foreground">
            {message}
          </span>
        ) : (
          <span className={`text-xs tabular-nums ${nearRowLimit ? "font-medium text-status-warning-foreground" : "text-muted-foreground"}`}>
            {viewActive && view.length !== rows.length ? `${view.length.toLocaleString("en-US")} shown · ` : ""}Rows: {rows.length.toLocaleString("en-US")} of {MAX_ROWS.toLocaleString("en-US")}
          </span>
        )}
      </div>
    </div>
  );
}

export const WorkspaceTableBlock = memo(TableBlockImpl, (a, b) => a.content === b.content && a.mobile === b.mobile);
