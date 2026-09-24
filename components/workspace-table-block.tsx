"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ClipboardEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, Calendar, Hash, Highlighter, ListChecks, Plus, SquareCheck, Trash2, Type, X } from "lucide-react";
import { KebabMenu } from "@/components/kebab-menu";
import type { KebabMenuItem } from "@/components/kebab-menu";
import { FILL_COLORS, MAX_COLUMNS, MAX_ROWS, addColumn, addRow, applyPaste, coerceCell, parsePastedGrid, removeColumn, removeRow, renameColumn, setCell, setCells, setColumnType, setFills } from "@/lib/workspace";
import { evaluateTable, isFormula } from "@/lib/workspace-formula";
import type { CellValue, ColumnType, TableColumn, TableContent, TableRow } from "@/lib/workspace";

const COLUMN_WIDTH = 140;
const GUTTER_WIDTH = 56;
const ADD_COLUMN_WIDTH = 44;

const TYPE_META: Record<ColumnType, { label: string; icon: ReactNode }> = {
  text: { label: "Text", icon: <Type className="h-3 w-3" aria-hidden /> },
  number: { label: "Number", icon: <Hash className="h-3 w-3" aria-hidden /> },
  date: { label: "Date", icon: <Calendar className="h-3 w-3" aria-hidden /> },
  checkbox: { label: "Checkbox", icon: <SquareCheck className="h-3 w-3" aria-hidden /> },
  dropdown: { label: "Dropdown", icon: <ListChecks className="h-3 w-3" aria-hidden /> },
};
const TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "dropdown"];

const EDITOR = "h-8 w-full min-w-0 bg-background px-2 text-sm text-foreground outline-none";
const SELECTED_TINT = "linear-gradient(color-mix(in oklab, var(--ring) 24%, transparent), color-mix(in oklab, var(--ring) 24%, transparent))";

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
  cellMouseDown: (e: MouseEvent, pos: Pos) => void;
  cellMouseEnter: (pos: Pos) => void;
  rowMouseDown: (e: MouseEvent, r: number) => void;
  startEdit: (pos: Pos, initial: string | null) => void;
  /** value undefined = throw the edit away. */
  finishEdit: (rowId: string, columnId: string, value: string | undefined, move: Move, refocus: boolean) => void;
  commit: (rowId: string, columnId: string, value: CellValue) => void;
  toggle: (rowId: string, columnId: string) => void;
  /** Returns true when the text was a multi-cell range and was handled. */
  pasteGrid: (text: string, pos: Pos) => boolean;
  deleteRow: (rowId: string) => void;
  flush: () => void;
};

/* Editing a text or number cell (after a double-click, Enter/F2, or typing).
   The draft only commits on Enter, Tab or leaving the cell -- setCell coerces,
   so a half-typed "1." must not be nulled mid-keystroke. Escape throws it
   away. An unparseable number stays flagged on Enter and is dropped on blur. */
function TextEditor({ start, numeric, onExit, onGridPaste, flush }: { start: string; numeric: boolean; onExit: (value: string | undefined, move: Move, refocus: boolean) => void; onGridPaste: (text: string) => boolean; flush: () => void }) {
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
      onChange={(e) => {
        draftRef.current = e.target.value;
        setDraft(e.target.value);
      }}
      // Switching to another window blurs the input too; stay in edit mode then, as Excel does.
      onBlur={() => {
        if (document.hasFocus()) exit(true, "none", false);
      }}
      onPaste={(e) => {
        if (!onGridPaste(e.clipboardData.getData("text/plain"))) return;
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
  /** Selected column span in this row (-1 when the row isn't in the selection). */
  selFrom: number;
  selTo: number;
  /** The active cell's column when it is in this row, else -1. */
  activeCol: number;
  editCol: number;
  editInitial: string | null;
};

/* One body row. Memoized: it only re-renders when its own row, position,
   formulas, highlights or selection change. */
const TableRowView = memo(function TableRowView({ row, pos, rowNumber, columns, api, computedJson, fillsJson, selFrom, selTo, activeCol, editCol, editInitial }: RowProps) {
  const computed: Record<string, string> = computedJson ? JSON.parse(computedJson) : {};
  const fills: Record<string, string> = fillsJson ? JSON.parse(fillsJson) : {};
  const rowSelected = selFrom >= 0;
  return (
    <tr className="group/row">
      <th
        scope="row"
        onMouseDown={(e) => api.rowMouseDown(e, pos)}
        title="Select this row"
        // Sticky cells need an opaque background, so the selection tint is layered over bg-muted.
        style={rowSelected ? { backgroundImage: SELECTED_TINT } : undefined}
        className={`sticky left-0 z-[5] cursor-pointer select-none border-b border-r border-ring/20 bg-muted p-0 text-xs font-normal ${rowSelected ? "text-foreground" : "text-muted-foreground group-hover/row:bg-[color-mix(in_oklab,var(--ring)_15%,var(--muted))]"}`}
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
              onExit={(value, move, refocus) => api.finishEdit(row.id, column.id, value, move, refocus)}
              onGridPaste={(text) => api.pasteGrid(text, { r: pos, c })}
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
            <div title={isFormula(raw) ? String(raw) : text || undefined} className={`h-8 truncate px-2 leading-8 ${right ? "text-right tabular-nums" : ""} ${isError ? "text-destructive" : ""}`}>
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
        if (rowSelected && c >= selFrom && c <= selTo && !editing) style.backgroundImage = SELECTED_TINT;
        if (c === activeCol || editing) style.boxShadow = "inset 0 0 0 2px var(--ring)";
        return (
          <td
            key={column.id}
            data-pos={`${pos}:${c}`}
            onMouseDown={editing ? undefined : (e) => api.cellMouseDown(e, { r: pos, c })}
            onMouseEnter={() => api.cellMouseEnter({ r: pos, c })}
            onDoubleClick={editing ? undefined : () => api.startEdit({ r: pos, c }, null)}
            style={style}
            className={`overflow-hidden border-b border-r border-ring/15 p-0 ${editing ? "" : "cursor-cell select-none"}`}
          >
            {body}
          </td>
        );
      })}
      <td className="border-b border-ring/15" />
    </tr>
  );
});

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
  onChange: (next: TableContent) => void;
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
  const [renameDraft, setRenameDraft] = useState("");
  const [sort, setSort] = useState<{ columnId: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const renameCancelled = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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
    const emit = (next: TableContent) => {
      contentRef.current = next;
      onChangeRef.current(next);
    };
    const select = (anchor: Pos, focus: Pos = anchor) => {
      selectionRef.current = { anchor, focus };
      setSelection({ anchor, focus });
      setMessage(null);
    };
    const focusGrid = () => wrapRef.current?.focus({ preventScroll: true });
    const cellAt = (pos: Pos) => {
      const current = contentRef.current;
      const row = current.rows[viewRef.current[pos.r]];
      const column = current.columns[pos.c];
      return row && column ? { row, column } : null;
    };
    const api: TableApi = {
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
        let next = current;
        if (value !== undefined && rowIndex >= 0 && colIndex >= 0) {
          const column = current.columns[colIndex];
          if (coerceCell(value, column.type, column.options) !== cellOf(current.rows[rowIndex], columnId)) next = setCell(current, rowId, columnId, value);
        }
        setEditing((e) => (e && e.rowId === rowId && e.colId === columnId ? null : e));
        const view = viewRef.current;
        const r = view.indexOf(rowIndex);
        if (move === "down" && r >= 0) {
          if (r + 1 < view.length) select({ r: r + 1, c: colIndex });
          else if (!viewActiveRef.current && next.rows.length < MAX_ROWS) {
            // Enter on the last row adds a new one, as before.
            next = addRow(next);
            select({ r: r + 1, c: colIndex });
          }
        } else if (move === "right" && r >= 0 && colIndex + 1 < current.columns.length) {
          select({ r, c: colIndex + 1 });
        }
        if (next !== current) emit(next);
        if (refocus) focusGrid();
      },
      commit: (rowId, columnId, value) => emit(setCell(contentRef.current, rowId, columnId, value)),
      toggle: (rowId, columnId) => {
        const row = contentRef.current.rows.find((r) => r.id === rowId);
        if (row) emit(setCell(contentRef.current, rowId, columnId, cellOf(row, columnId) !== true));
      },
      pasteGrid: (text, pos) => {
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
        const next = applyPaste(contentRef.current, startRow, pos.c, grid);
        emit(next);
        const width = Math.max(...grid.map((line) => line.length));
        select(pos, { r: Math.min(next.rows.length - 1, pos.r + grid.length - 1), c: Math.min(next.columns.length - 1, pos.c + width - 1) });
        return true;
      },
      deleteRow: (rowId) => {
        const current = contentRef.current;
        const index = current.rows.findIndex((r) => r.id === rowId);
        if (index < 0) return;
        if (Object.values(current.rows[index].cells).some((v) => v !== null && v !== undefined) && !window.confirm(`Delete row ${index + 1}?`)) return;
        emit(removeRow(current, rowId));
      },
      flush: () => onFlushRef.current?.(),
    };
    return api;
  });

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
      contentRef.current = setColumnType(current, columnId, type, options);
      onChangeRef.current(contentRef.current);
    },
    deleteColumn: (columnId: string) => {
      const current = contentRef.current;
      const lost = current.rows.filter((r) => cellOf(r, columnId) !== null).length;
      if (!confirmClear(lost)) return;
      contentRef.current = removeColumn(current, columnId);
      onChangeRef.current(contentRef.current);
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

  // Which rows to show, and in what order. This is only a view: the saved table keeps its own order.
  const view = useMemo(() => {
    const textOf = (row: TableRow, columnId: string): string => {
      const shownText = computedByRow[row.id]?.[columnId];
      if (shownText !== undefined) return shownText;
      const raw = cellOf(row, columnId);
      return raw === null || raw === undefined ? "" : String(raw);
    };
    const needle = filter.trim().toLowerCase();
    let indexes = rows.map((_, i) => i);
    if (needle) indexes = indexes.filter((i) => columns.some((c) => textOf(rows[i], c.id).toLowerCase().includes(needle)));
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
    return indexes;
  }, [rows, columns, computedByRow, filter, sort]);
  const viewActive = filter.trim() !== "" || sort !== null;

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

  function apply(next: TableContent) {
    if (next === contentRef.current) return;
    contentRef.current = next;
    onChangeRef.current(next);
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

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !sel) return; // editors and header inputs handle their own keys
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
        apply(setCells(contentRef.current, selectedCells(), null));
        return;
      case "Escape":
        e.preventDefault();
        set(sel.anchor);
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

  function onGridCopy(e: ClipboardEvent<HTMLDivElement>, cut: boolean) {
    if (e.target !== e.currentTarget || !sel) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", selectionText());
    if (cut) apply(setCells(contentRef.current, selectedCells(), null));
  }

  function onGridPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !sel) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (api.pasteGrid(text, sel.anchor)) return;
    // One value goes into every selected cell, as in Excel.
    apply(setCells(contentRef.current, selectedCells(), text.replace(/(\r\n|\n)$/, "")));
  }

  function selectColumn(c: number) {
    if (view.length === 0) return;
    wrapRef.current?.focus({ preventScroll: true });
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
      contentRef.current = renameColumn(contentRef.current, column.id, renameDraft);
      onChangeRef.current(contentRef.current);
    }
  }

  function menuItems(column: TableColumn): KebabMenuItem[] {
    const onlyColumn = columns.length <= 1;
    return [
      { label: "Rename", onClick: () => startRename(column) },
      { label: "Sort A → Z", onClick: () => setSort({ columnId: column.id, dir: "asc" }) },
      { label: "Sort Z → A", onClick: () => setSort({ columnId: column.id, dir: "desc" }) },
      ...(sort?.columnId === column.id ? [{ label: "Clear sort", onClick: () => setSort(null) }] : []),
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
    apply(setFills(contentRef.current, selectedCells(), color));
  }

  const tableWidth = GUTTER_WIDTH + columns.length * COLUMN_WIDTH + ADD_COLUMN_WIDTH;
  const headerCell = "sticky top-0 z-10 border-b border-r border-ring/20";
  const selectedCount = sel ? (sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1) : 0;

  return (
    <div className={`flex min-h-0 flex-col ${mobile ? "max-h-[65vh]" : "h-full"}`}>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="grid"
        aria-label="Table"
        aria-multiselectable
        className="min-h-0 flex-1 overflow-auto outline-none"
        onPointerDownCapture={(e) => {
          pointerType.current = e.pointerType;
        }}
        onFocus={(e) => {
          // Tabbing into the table selects its first cell.
          if (e.target === e.currentTarget && !selectionRef.current && view.length > 0 && columns.length > 0) setSelection({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
        }}
        onKeyDown={onGridKeyDown}
        onCopy={(e) => onGridCopy(e, false)}
        onCut={(e) => onGridCopy(e, true)}
        onPaste={onGridPaste}
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
                className={`${headerCell} left-0 z-20 cursor-pointer bg-muted hover:bg-[color-mix(in_oklab,var(--ring)_15%,var(--muted))]`}
                title="Select all"
                aria-label="Select all"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (view.length === 0) return;
                  wrapRef.current?.focus({ preventScroll: true });
                  setSelection({ anchor: { r: 0, c: 0 }, focus: { r: view.length - 1, c: columns.length - 1 } });
                }}
              />
              {columns.map((column, c) => {
                const columnSelected = !!sel && c >= sel.c1 && c <= sel.c2;
                return (
                  <th key={column.id} scope="col" style={columnSelected ? { backgroundImage: SELECTED_TINT } : undefined} className={`${headerCell} bg-muted p-0 text-left font-medium`}>
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
                      <KebabMenu items={menuItems(column)} ariaLabel={`Options for column ${column.name}`} />
                    </div>
                  </th>
                );
              })}
              <th className={`${headerCell} bg-muted p-0`}>
                <button
                  type="button"
                  disabled={atMaxColumns}
                  title={atMaxColumns ? `A table can have at most ${MAX_COLUMNS} columns.` : "Add a column"}
                  aria-label="Add a column"
                  onClick={() => {
                    contentRef.current = addColumn(contentRef.current);
                    onChangeRef.current(contentRef.current);
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
                  selFrom={inSel ? sel.c1 : -1}
                  selTo={inSel ? sel.c2 : -1}
                  activeCol={sel && sel.anchor.r === pos ? sel.anchor.c : -1}
                  editCol={editCol}
                  editInitial={editCol >= 0 ? editing!.initial : null}
                />
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No rows yet. Use “Row” below.</p>}
        {rows.length > 0 && view.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No rows match “{filter}”.</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ring/20 bg-muted/50 px-2 py-1">
        <button
          type="button"
          disabled={atMaxRows}
          title={atMaxRows ? `A table can have at most ${MAX_ROWS.toLocaleString("en-US")} rows.` : "Add a row"}
          onClick={() => {
            setFilter(""); // a new blank row would not match the filter
            contentRef.current = addRow(contentRef.current);
            onChangeRef.current(contentRef.current);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ring transition-colors hover:bg-ring/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" /> Row
        </button>
        <div className="flex items-center gap-1" role="group" aria-label="Highlight the selected cells">
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {FILL_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={!sel}
              title={sel ? `Highlight ${selectedCount === 1 ? "cell" : `${selectedCount} cells`} ${c.name.toLowerCase()}` : "Select cells first"}
              aria-label={`Highlight ${c.name.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => highlight(c.value)}
              className="h-4 w-4 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            disabled={!sel}
            title={sel ? "Remove highlight" : "Select cells first"}
            aria-label="Remove highlight"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => highlight(null)}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
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
