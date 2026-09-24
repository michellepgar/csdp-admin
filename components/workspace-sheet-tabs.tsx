"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import type { Sheet } from "@/lib/workspace";

export type WorkspaceAction = (formData: FormData) => Promise<{ error: string | null; id?: string }>;

const GENERIC_ERROR = "Something went wrong. Please try again.";

/* The tab strip above a workbook's canvas. Selecting a tab is the caller's
   job (onSelect) -- it also keeps the active sheet in the URL. Everything
   else (add, rename, delete, drag to reorder) is handled here through the
   sheet Server Actions; the server props then refresh the list. */
export function WorkspaceSheetTabs({
  workbookId,
  sheets,
  activeId,
  onSelect,
  onCreated,
  onDeleted,
  createSheet,
  renameSheet,
  reorderSheets,
  deleteSheet,
}: {
  workbookId: string;
  sheets: Sheet[];
  activeId: string;
  onSelect: (id: string) => void;
  /** A new sheet was created (it may not be in `sheets` yet). */
  onCreated: (id: string) => void;
  /** A sheet was deleted; fallbackId is its previous neighbour (else the next). */
  onDeleted: (id: string, fallbackId: string | null) => void;
  createSheet: WorkspaceAction;
  renameSheet: WorkspaceAction;
  reorderSheets: WorkspaceAction;
  deleteSheet: WorkspaceAction;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cancelRef = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // A local order the drop applies instantly; cleared whenever fresh server data arrives.
  const [order, setOrder] = useState<string[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fresh server data replaces the optimistic drop order.
    setOrder(null);
  }, [sheets]);

  const shown = order
    ? [...order.map((id) => sheets.find((s) => s.id === id)).filter((s): s is Sheet => !!s), ...sheets.filter((s) => !order.includes(s.id))]
    : sheets;

  function run(action: WorkspaceAction, fields: Record<string, string>, after?: (result: { error: string | null; id?: string }) => void, onFail?: () => void) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.error) {
          setError(result.error);
          onFail?.();
        } else {
          setError(null);
          after?.(result);
        }
      } catch {
        setError(GENERIC_ERROR);
        onFail?.();
      }
    });
  }

  function add() {
    run(createSheet, { workbookId }, (result) => {
      if (result.id) onCreated(result.id);
    });
  }

  function startRename(sheet: Sheet) {
    cancelRef.current = false;
    setDraft(sheet.name);
    setEditingId(sheet.id);
  }

  function commitRename(sheet: Sheet) {
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setEditingId(null);
    const name = draft.trim();
    if (cancelled || !name || name === sheet.name) return;
    run(renameSheet, { id: sheet.id, name });
  }

  function remove(sheet: Sheet) {
    if (!window.confirm(`Delete "${sheet.name}" and everything on it? This can't be undone.`)) return;
    const index = shown.findIndex((s) => s.id === sheet.id);
    const fallbackId = (shown[index - 1] ?? shown[index + 1])?.id ?? null;
    run(deleteSheet, { id: sheet.id }, () => onDeleted(sheet.id, fallbackId));
  }

  function drop(targetId: string) {
    const from = draggedId;
    setDraggedId(null);
    if (!from || from === targetId) return;
    const ids = shown.map((s) => s.id);
    const fromIndex = ids.indexOf(from);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    setOrder(ids);
    run(reorderSheets, { workbookId, orderedIds: JSON.stringify(ids) }, undefined, () => setOrder(null));
  }

  return (
    <div className="min-w-0 flex-1">
      <div role="tablist" aria-label="Sheets" className="flex items-end gap-1 overflow-x-auto pb-0">
        {shown.map((sheet) => {
          const isActive = sheet.id === activeId;
          const editing = editingId === sheet.id;
          return (
            <div
              key={sheet.id}
              role="presentation"
              draggable={!editing}
              onDragStart={(e) => {
                setDraggedId(sheet.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", sheet.id);
              }}
              onDragOver={(e) => { if (draggedId) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); drop(sheet.id); }}
              onDragEnd={() => setDraggedId(null)}
              className={`group flex shrink-0 items-center gap-1 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-ring/40 border-t-2 border-t-ring bg-record-background no-record-hover font-semibold text-foreground shadow-sm"
                  : "border-transparent bg-muted/70 text-muted-foreground hover:bg-ring/15 hover:text-foreground"
              } ${draggedId === sheet.id ? "opacity-40" : ""}`}
            >
              {editing ? (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(sheet)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      cancelRef.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                  maxLength={40}
                  autoFocus
                  aria-label="Sheet name"
                  className="h-6 w-28 rounded border border-ring/50 bg-background px-1.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                />
              ) : (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelect(sheet.id)}
                    onDoubleClick={() => startRename(sheet)}
                    title="Double-click to rename, drag to reorder"
                    className="max-w-40 truncate"
                  >
                    {sheet.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(sheet)}
                    title="Rename sheet"
                    aria-label={`Rename ${sheet.name}`}
                    className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:bg-ring/15 hover:text-ring group-hover:opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(sheet)}
                    disabled={sheets.length <= 1}
                    title={sheets.length <= 1 ? "A workbook needs at least one sheet" : "Delete sheet"}
                    aria-label={`Delete ${sheet.name}`}
                    className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-25"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          disabled={pending}
          title="Add a sheet"
          aria-label="Add a sheet"
          className="mb-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ring/15 text-ring transition-colors hover:bg-ring/30 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-2 mt-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
