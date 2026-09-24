"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import { Calendar, Hash, ListChecks, Plus, SquareCheck, Trash2, Type } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { KebabMenu } from "@/components/kebab-menu";
import type { KebabMenuItem } from "@/components/kebab-menu";
import { MAX_COLUMNS, MAX_ROWS, addColumn, addRow, applyPaste, parsePastedGrid, removeColumn, removeRow, renameColumn, setCell, setColumnType } from "@/lib/workspace";
import type { CellValue, ColumnType, TableColumn, TableContent } from "@/lib/workspace";

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

/* A text or number cell. It keeps a local draft while typing and only commits
   on blur or Enter (setCell coerces, so a half-typed "1." must not be nulled
   mid-keystroke). Escape throws the draft away. */
function TextCell({
  value,
  numeric,
  rowIndex,
  colIndex,
  onCommit,
  onEnter,
  onPaste,
}: {
  value: CellValue;
  numeric: boolean;
  rowIndex: number;
  colIndex: number;
  onCommit: (value: string) => void;
  onEnter: (value: string) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const shown = value === null || value === undefined ? "" : String(value);

  function update(next: string | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function commit() {
    const pending = draftRef.current;
    update(null);
    if (pending !== null && pending !== shown) onCommit(pending);
  }

  return (
    <input
      type="text"
      data-cell={`${rowIndex}:${colIndex}`}
      inputMode={numeric ? "decimal" : undefined}
      value={draft ?? shown}
      title={draft === null && shown ? shown : undefined}
      onChange={(e) => update(e.target.value)}
      onBlur={commit}
      onPaste={onPaste}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const pending = draftRef.current;
          update(null);
          onEnter(pending ?? shown);
        } else if (e.key === "Escape") {
          e.preventDefault();
          update(null);
        }
      }}
      className={`${CELL_INPUT} truncate ${numeric ? "text-right tabular-nums" : ""}`}
    />
  );
}

/* Change-type panel shown inside the column's kebab menu. */
function TypePanel({ column, onApply, close }: { column: TableColumn; onApply: (type: ColumnType, options?: string[]) => void; close: () => void }) {
  const [choice, setChoice] = useState<ColumnType>(column.type);
  const [optionsText, setOptionsText] = useState((column.options ?? []).join(", "));

  function apply() {
    if (choice === "dropdown") {
      const options = optionsText
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      onApply("dropdown", options);
    } else {
      onApply(choice);
    }
    close();
  }

  return (
    <div className="w-52 space-y-2">
      <div role="radiogroup" aria-label="Column type" className="space-y-0.5">
        {TYPES.map((type) => (
          <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-ring/10 ${choice === type ? "bg-ring/10 font-medium text-ring" : ""}`}>
            <input
              type="radio"
              name={`column-type-${column.id}`}
              checked={choice === type}
              onChange={() => {
                setChoice(type);
                if (type !== "dropdown") {
                  onApply(type);
                  close();
                }
              }}
              className="sr-only"
            />
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
          <button type="button" onClick={apply} className="w-full rounded-lg bg-ring/15 px-2 py-1 text-sm font-medium text-ring transition-colors hover:bg-ring/25">
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/* The editable grid body of a table block. Every mutation goes through the
   pure helpers in lib/workspace.ts; the whole table is one payload. */
export function WorkspaceTableBlock({ content, onChange }: { content: TableContent; onChange: (next: TableContent) => void }) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameCancelled = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);

  const { columns, rows } = content;
  const atMaxRows = rows.length >= MAX_ROWS;
  const atMaxColumns = columns.length >= MAX_COLUMNS;
  const nearRowLimit = rows.length > MAX_ROWS * 0.9;

  /* Move focus once the row a keypress created (or moved to) exists in the DOM. */
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${target.row}:${target.col}"]`);
    el?.focus();
    if (el instanceof HTMLInputElement && el.type === "text") el.select();
  });

  function commitCell(rowId: string, columnId: string, value: CellValue) {
    onChange(setCell(content, rowId, columnId, value));
  }

  function enterCell(rowIndex: number, colIndex: number, value: string) {
    const row = rows[rowIndex];
    const column = columns[colIndex];
    let next = content;
    if (row && column) next = setCell(next, row.id, column.id, value);
    if (rowIndex + 1 >= next.rows.length) {
      if (next.rows.length >= MAX_ROWS) {
        if (next !== content) onChange(next);
        return;
      }
      next = addRow(next);
    }
    pendingFocus.current = { row: rowIndex + 1, col: colIndex };
    onChange(next);
  }

  function pasteInto(e: ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n\r]/.test(text)) return;
    const grid = parsePastedGrid(text);
    e.preventDefault();
    if (grid.length === 0) return;
    onChange(applyPaste(content, rowIndex, colIndex, grid));
  }

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
    if (renameDraft.trim() && renameDraft.trim() !== column.name) onChange(renameColumn(content, column.id, renameDraft));
  }

  function menuItems(column: TableColumn): KebabMenuItem[] {
    const onlyColumn = columns.length <= 1;
    return [
      { label: "Rename", onClick: () => startRename(column) },
      {
        label: "Change type",
        panel: (close) => <TypePanel column={column} onApply={(type, options) => onChange(setColumnType(content, column.id, type, options))} close={close} />,
      },
      onlyColumn
        ? { label: "Delete column", destructive: true, panel: () => <p className="w-48 text-sm text-muted-foreground">A table needs at least one column, so this one can&apos;t be deleted.</p> }
        : { label: "Delete column", destructive: true, onClick: () => onChange(removeColumn(content, column.id)) },
    ];
  }

  const tableWidth = GUTTER_WIDTH + columns.length * COLUMN_WIDTH + ADD_COLUMN_WIDTH;
  const headerCell = "sticky top-0 z-10 border-b border-r border-ring/20 bg-muted";

  return (
    <div className="flex h-full min-h-32 flex-col">
      <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto">
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
                  onClick={() => onChange(addColumn(content))}
                  className="flex h-9 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-ring/15 hover:text-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className="group/row">
                <th scope="row" className="sticky left-0 z-[5] border-b border-r border-ring/20 bg-muted p-0 text-xs font-normal text-muted-foreground group-hover/row:bg-ring/15">
                  <div className="relative flex h-8 items-center justify-between pl-2 pr-1">
                    <span className="tabular-nums">{rowIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => onChange(removeRow(content, row.id))}
                      title={`Delete row ${rowIndex + 1}`}
                      aria-label={`Delete row ${rowIndex + 1}`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
                {columns.map((column, colIndex) => {
                  const raw = Object.hasOwn(row.cells, column.id) ? row.cells[column.id] : null;
                  const paste = (e: ClipboardEvent<HTMLInputElement>) => pasteInto(e, rowIndex, colIndex);
                  let body: ReactNode;
                  if (column.type === "checkbox") {
                    body = (
                      <div className="flex h-8 items-center justify-center">
                        <input
                          type="checkbox"
                          data-cell={`${rowIndex}:${colIndex}`}
                          checked={raw === true}
                          onChange={(e) => commitCell(row.id, column.id, e.target.checked)}
                          onPaste={paste}
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
                        onChange={(e) => commitCell(row.id, column.id, e.target.value)}
                        onPaste={paste}
                        aria-label={`${column.name}, row ${rowIndex + 1}`}
                        className={CELL_INPUT}
                      />
                    );
                  } else if (column.type === "dropdown") {
                    body = (
                      <div className="flex h-8 items-center px-1 [&>div]:block [&>div]:w-full">
                        <Dropdown
                          name={`cell-${row.id}-${column.id}`}
                          value={typeof raw === "string" ? raw : ""}
                          options={[{ value: "", label: "—" }, ...(column.options ?? []).map((o) => ({ value: o, label: o }))]}
                          className="!py-0.5 text-xs"
                          onChange={(v) => commitCell(row.id, column.id, v === "" ? null : v)}
                        />
                      </div>
                    );
                  } else {
                    body = (
                      <TextCell
                        value={raw}
                        numeric={column.type === "number"}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                        onCommit={(v) => commitCell(row.id, column.id, v)}
                        onEnter={(v) => enterCell(rowIndex, colIndex, v)}
                        onPaste={paste}
                      />
                    );
                  }
                  return (
                    <td key={column.id} className="overflow-hidden border-b border-r border-ring/15 p-0 transition-colors group-hover/row:bg-ring/5">
                      {body}
                    </td>
                  );
                })}
                <td className="border-b border-ring/15 group-hover/row:bg-ring/5" />
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No rows yet. Use “Add row” below.</p>}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-ring/20 bg-muted/50 px-2 py-1">
        <button
          type="button"
          disabled={atMaxRows}
          title={atMaxRows ? `A table can have at most ${MAX_ROWS.toLocaleString("en-US")} rows.` : "Add a row"}
          onClick={() => onChange(addRow(content))}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ring transition-colors hover:bg-ring/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" /> Row
        </button>
        <span className={`text-xs tabular-nums ${nearRowLimit ? "font-medium text-status-warning-foreground" : "text-muted-foreground"}`}>
          Rows: {rows.length.toLocaleString("en-US")} of {MAX_ROWS.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
