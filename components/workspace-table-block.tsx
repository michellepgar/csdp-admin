"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, Calendar, Hash, Highlighter, ListChecks, Plus, SquareCheck, Trash2, Type, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { KebabMenu } from "@/components/kebab-menu";
import type { KebabMenuItem } from "@/components/kebab-menu";
import { FILL_COLORS, MAX_COLUMNS, MAX_ROWS, addColumn, addRow, applyPaste, coerceCell, parsePastedGrid, removeColumn, removeRow, renameColumn, setCell, setColumnType, setFill } from "@/lib/workspace";
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

const CELL_INPUT = "h-8 w-full min-w-0 bg-transparent px-2 text-sm outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";

const cellOf = (row: TableRow, columnId: string): CellValue => (Object.hasOwn(row.cells, columnId) ? row.cells[columnId] : null);

/* Every handler the rows need. Built once and never changes identity; each
   one reads the latest table from a ref, so memoized rows never see (or
   act on) a stale copy. */
type TableApi = {
  commit: (rowId: string, columnId: string, value: CellValue) => void;
  enter: (rowIndex: number, colIndex: number, value: string | null) => void;
  /** Returns true when it handled a multi-cell paste (the caller drops its draft). */
  paste: (e: ClipboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => boolean;
  deleteRow: (rowId: string) => void;
  flush: () => void;
};

/* A text or number cell. It keeps a local draft while typing and only commits
   on blur or Enter (setCell coerces, so a half-typed "1." must not be nulled
   mid-keystroke). Escape throws the draft away. An unparseable number is
   never committed: it stays flagged while typing and reverts on blur. */
function TextCell({ value, computed, numeric, rowIndex, colIndex, api, onCommit }: { value: CellValue; computed?: string; numeric: boolean; rowIndex: number; colIndex: number; api: TableApi; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef<string | null>(null);
  const shown = value === null || value === undefined ? "" : String(value);
  const isInvalid = (text: string | null) => numeric && text !== null && text.trim() !== "" && coerceCell(text, "number") === null;
  const invalid = isInvalid(draft);
  // A formula shows its result until you click in to edit it.
  const showResult = computed !== undefined && !focused && draft === null;
  const isError = showResult && computed.startsWith("#");

  function update(next: string | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function commit() {
    const pending = draftRef.current;
    update(null);
    if (pending !== null && pending !== shown && !isInvalid(pending)) onCommit(pending);
  }

  // Leaving the page with a half-typed cell: commit it and save right away.
  const hideRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    hideRef.current = () => {
      if (draftRef.current === null) return;
      commit();
      api.flush();
    };
  });
  const hasDraft = draft !== null;
  useEffect(() => {
    if (!hasDraft) return;
    const onHide = () => hideRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hideRef.current();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasDraft]);

  return (
    <input
      type="text"
      data-cell={`${rowIndex}:${colIndex}`}
      inputMode={numeric ? "decimal" : undefined}
      value={showResult ? computed : (draft ?? shown)}
      title={invalid ? "Enter a number" : draft === null && shown ? shown : undefined}
      aria-invalid={invalid || undefined}
      onChange={(e) => update(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        // The box swaps a formula's result for its text on focus; select that text afterwards so typing replaces it.
        if (computed !== undefined) {
          const el = e.currentTarget;
          setTimeout(() => el.select(), 0);
        }
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onPaste={(e) => {
        if (api.paste(e, rowIndex, colIndex)) update(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (e.nativeEvent.isComposing) return;
          e.preventDefault();
          const pending = draftRef.current;
          if (isInvalid(pending)) return; // keep the draft and the flag
          update(null);
          api.enter(rowIndex, colIndex, pending);
        } else if (e.key === "Escape") {
          e.preventDefault();
          update(null);
        }
      }}
      className={`${CELL_INPUT} truncate ${numeric || (showResult && !isError) ? "text-right tabular-nums" : ""} ${isError ? "text-destructive" : ""} ${invalid ? "bg-destructive/10 ring-1 ring-inset ring-destructive" : ""}`}
    />
  );
}

/* One body row. Memoized: it only re-renders when its own row object, its
   index or the columns change. */
const TableRowView = memo(function TableRowView({ row, rowIndex, columns, api, computedJson, fillsJson }: { row: TableRow; rowIndex: number; columns: TableColumn[]; api: TableApi; computedJson: string; fillsJson: string }) {
  // Passed as JSON text so the memo comparison is by value.
  const computed: Record<string, string> = computedJson ? JSON.parse(computedJson) : {};
  const fills: Record<string, string> = fillsJson ? JSON.parse(fillsJson) : {};
  return (
    <tr className="group/row">
      <th scope="row" className="sticky left-0 z-[5] border-b border-r border-ring/20 bg-muted p-0 text-xs font-normal text-muted-foreground group-hover/row:bg-ring/15">
        <div className="relative flex h-8 items-center justify-between pl-2 pr-1">
          <span className="tabular-nums">{rowIndex + 1}</span>
          <button
            type="button"
            onClick={() => api.deleteRow(row.id)}
            title={`Delete row ${rowIndex + 1}`}
            aria-label={`Delete row ${rowIndex + 1}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </th>
      {columns.map((column, colIndex) => {
        const raw = cellOf(row, column.id);
        let body: ReactNode;
        if (column.type === "checkbox") {
          body = (
            <div className="flex h-8 items-center justify-center">
              <input
                type="checkbox"
                data-cell={`${rowIndex}:${colIndex}`}
                checked={raw === true}
                onChange={(e) => api.commit(row.id, column.id, e.target.checked)}
                onPaste={(e) => api.paste(e, rowIndex, colIndex)}
                aria-label={`${column.name}, row ${rowIndex + 1}`}
                className="h-4 w-4 cursor-pointer accent-ring"
              />
            </div>
          );
        } else if (column.type === "date") {
          body = (
            <input
              type="date"
              data-cell={`${rowIndex}:${colIndex}`}
              value={typeof raw === "string" ? raw : ""}
              onChange={(e) => api.commit(row.id, column.id, e.target.value)}
              onPaste={(e) => api.paste(e, rowIndex, colIndex)}
              aria-label={`${column.name}, row ${rowIndex + 1}`}
              className={CELL_INPUT}
            />
          );
        } else if (column.type === "dropdown") {
          // The paste handler sits on the wrapper: a paste while the dropdown's
          // trigger button has focus bubbles up to it.
          body = (
            <div data-cell={`${rowIndex}:${colIndex}`} onPaste={(e) => api.paste(e, rowIndex, colIndex)} className="flex h-8 items-center px-1 [&>div]:block [&>div]:w-full">
              <Dropdown
                name={`cell-${row.id}-${column.id}`}
                value={typeof raw === "string" ? raw : ""}
                options={[{ value: "", label: "—" }, ...(column.options ?? []).map((o) => ({ value: o, label: o }))]}
                className="!py-0.5 text-xs"
                onChange={(v) => api.commit(row.id, column.id, v === "" ? null : v)}
              />
            </div>
          );
        } else {
          body = <TextCell value={raw} computed={computed[column.id]} numeric={column.type === "number"} rowIndex={rowIndex} colIndex={colIndex} api={api} onCommit={(v) => api.commit(row.id, column.id, v)} />;
        }
        return (
          <td key={column.id} data-row={row.id} data-col={column.id} style={fills[column.id] ? { backgroundColor: fills[column.id], color: "#1a1a1a" } : undefined} className="overflow-hidden border-b border-r border-ring/15 p-0 transition-colors group-hover/row:bg-ring/5">
            {body}
          </td>
        );
      })}
      <td className="border-b border-ring/15 group-hover/row:bg-ring/5" />
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

/* The editable grid body of a table block. Every mutation goes through the
   pure helpers in lib/workspace.ts; the whole table is one payload.

   PERFORMANCE. The block is memoized on `content` and `mobile` only (the
   canvas hands over a fresh onChange arrow every render, so that prop is
   ignored for comparison -- the latest one is kept in a ref). A canvas
   re-render caused by dragging some block therefore never reaches the cells.
   Rows are memoized too; setCell/addRow/removeRow keep untouched rows'
   identity, so typing in one cell re-renders one row. (applyPaste rebuilds
   every row, so a paste re-renders all rows once.) */
function TableBlockImpl({ content, onChange, onFlush, mobile = false }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ columnId: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState("");
  const [activeCell, setActiveCell] = useState<{ rowId: string; colId: string } | null>(null);
  // Original row positions in the order they are shown; null while nothing is sorted or filtered.
  const viewRef = useRef<number[] | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameCancelled = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);
  const contentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  const onFlushRef = useRef(onFlush);
  useLayoutEffect(() => {
    contentRef.current = content;
    onChangeRef.current = onChange;
    onFlushRef.current = onFlush;
  });

  const [api] = useState(() => {
    /* Two changes in one tick must build on each other, so the ref moves
       forward immediately instead of waiting for the re-render. */
    const emit = (next: TableContent) => {
      contentRef.current = next;
      onChangeRef.current(next);
    };
    const focusCell = (row: number, col: number): boolean => {
      const el = wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`);
      const target = el && (el.matches("input, button") ? el : el.querySelector<HTMLElement>("button"));
      if (!target) return false;
      target.focus();
      if (target instanceof HTMLInputElement && target.type === "text") target.select();
      return true;
    };
    const api: TableApi = {
      commit: (rowId, columnId, value) => emit(setCell(contentRef.current, rowId, columnId, value)),
      enter: (rowIndex, colIndex, value) => {
        const current = contentRef.current;
        const row = current.rows[rowIndex];
        const column = current.columns[colIndex];
        let next = current;
        if (value !== null && row && column && coerceCell(value, column.type, column.options) !== cellOf(row, column.id)) {
          next = setCell(current, row.id, column.id, value);
        }
        const view = viewRef.current;
        if (view) {
          // Sorted or filtered: Enter moves to the next row you can see.
          if (next !== current) emit(next);
          const at = view.indexOf(rowIndex);
          if (at >= 0 && at + 1 < view.length) focusCell(view[at + 1], colIndex);
          return;
        }
        if (rowIndex + 1 < next.rows.length) {
          if (next !== current) emit(next);
          focusCell(rowIndex + 1, colIndex);
          return;
        }
        if (next.rows.length >= MAX_ROWS) {
          if (next !== current) emit(next);
          return;
        }
        pendingFocus.current = { row: rowIndex + 1, col: colIndex };
        emit(addRow(next));
      },
      paste: (e, rowIndex, colIndex) => {
        // Excel appends one line break to even a single-cell copy; that is not a grid.
        const text = e.clipboardData.getData("text/plain").replace(/(\r\n|\n)$/, "");
        if (!/[\t\n\r]/.test(text)) return false;
        const grid = parsePastedGrid(text);
        e.preventDefault();
        if (viewRef.current) return true; // a sorted or filtered view would paste into the wrong rows
        if (grid.length > 0) emit(applyPaste(contentRef.current, rowIndex, colIndex, grid));
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

  /* Move focus once the row a keypress created exists in the DOM. */
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${target.row}:${target.col}"]`);
    el?.focus();
    if (el instanceof HTMLInputElement && el.type === "text") el.select();
  });

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
  useLayoutEffect(() => {
    viewRef.current = viewActive ? view : null;
  });
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

  const tableWidth = GUTTER_WIDTH + columns.length * COLUMN_WIDTH + ADD_COLUMN_WIDTH;
  const headerCell = "sticky top-0 z-10 border-b border-r border-ring/20 bg-muted";

  return (
    <div className={`flex min-h-0 flex-col ${mobile ? "max-h-[65vh]" : "h-full"}`}>
      <div
        ref={wrapRef}
        className="min-h-0 flex-1 overflow-auto"
        onFocus={(e) => {
          const cell = (e.target as HTMLElement).closest("td[data-col]");
          if (cell) setActiveCell({ rowId: cell.getAttribute("data-row") ?? "", colId: cell.getAttribute("data-col") ?? "" });
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
              <th className={`${headerCell} left-0 z-20`} aria-label="Row" />
              {columns.map((column) => (
                <th key={column.id} scope="col" className={`${headerCell} p-0 text-left font-medium`}>
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
                        <span className="min-w-0 flex-1 cursor-text truncate" title={`${column.name} (double-click to rename)`} onDoubleClick={() => startRename(column)}>
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
              ))}
              <th className={`${headerCell} p-0`}>
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
            {view.map((rowIndex) => {
              const row = rows[rowIndex];
              const computed = computedByRow[row.id];
              const fills = fillsByRow[row.id];
              return <TableRowView key={row.id} row={row} rowIndex={rowIndex} columns={columns} api={api} computedJson={computed ? JSON.stringify(computed) : ""} fillsJson={fills ? JSON.stringify(fills) : ""} />;
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
        <div className="flex items-center gap-1" role="group" aria-label="Highlight the selected cell">
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {FILL_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={!activeCell}
              title={activeCell ? `Highlight ${c.name.toLowerCase()}` : "Click a cell first"}
              aria-label={`Highlight ${c.name.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!activeCell) return;
                contentRef.current = setFill(contentRef.current, activeCell.rowId, activeCell.colId, c.value);
                onChangeRef.current(contentRef.current);
              }}
              className="h-4 w-4 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            disabled={!activeCell}
            title={activeCell ? "Remove highlight" : "Click a cell first"}
            aria-label="Remove highlight"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!activeCell) return;
              contentRef.current = setFill(contentRef.current, activeCell.rowId, activeCell.colId, null);
              onChangeRef.current(contentRef.current);
            }}
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
        <span className={`text-xs tabular-nums ${nearRowLimit ? "font-medium text-status-warning-foreground" : "text-muted-foreground"}`}>
          {viewActive && view.length !== rows.length ? `${view.length.toLocaleString("en-US")} shown · ` : ""}Rows: {rows.length.toLocaleString("en-US")} of {MAX_ROWS.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

export const WorkspaceTableBlock = memo(TableBlockImpl, (a, b) => a.content === b.content && a.mobile === b.mobile);
