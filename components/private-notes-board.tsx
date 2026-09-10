"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteCardContent } from "@/components/note-card-content";
import type { PrivateNote } from "@/lib/app-state";

const DEFAULT_BOARD_NOTE_WIDTH = 192; // matches the w-48 class this card used before boardWidth existed
const MIN_BOARD_NOTE_WIDTH = 140;
const MAX_BOARD_NOTE_WIDTH = 640;
const MIN_BOARD_NOTE_HEIGHT = 80;
const MAX_BOARD_NOTE_HEIGHT = 640;

/* One note pinned to the board -- laid out in normal document flow
   (flex-wrap on the parent), not freely positioned. Free drag/move/
   rotate (via react-moveable) was tried first but proved confusing in
   practice (an unreliable "move" gesture, notes draggable off-screen
   entirely) -- an ordered left-to-right layout you rearrange via the
   board's Reorder mode is simpler and has no equivalent failure mode.

   No rotation either -- pinPrivateNote (app/(app)/private-notes/actions.ts)
   used to give each note a small random decorative tilt, but Michelle
   asked for pinned notes to sit straight, so note.boardRotation is
   never read here anymore regardless of what's stored (an old note
   pinned before this change can still carry a nonzero value; ignoring
   it here straightens those out too, not just newly-pinned ones).

   Width AND height are adjustable, by request -- a resize handle on
   the right edge (width) and another on the bottom edge (height) --
   still no move/rotate, so this sidesteps the earlier Moveable
   failure modes since flex-wrap still owns layout: a wider note just
   takes more of its row and pushes later notes to wrap, nothing can
   end up off-screen or overlapping another note the way free
   positioning could. Height starts as "auto" (grows with content,
   same as before either resize existed) until actually dragged --
   only once note.boardHeight is set does the card switch to a fixed
   height with its own internal scroll (overflow-y-auto) so a height
   shorter than the content scrolls inside the card instead of
   clipping or spilling into whatever's below it on the board. */
function BoardNote({
  note,
  currentUserName,
  reorderMode,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onReturnToList,
  resizePinnedNoteWidth,
  resizePinnedNoteHeight,
}: {
  note: PrivateNote;
  currentUserName: string;
  reorderMode: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onReturnToList: (id: string) => void;
  resizePinnedNoteWidth: (id: string, width: number) => void;
  resizePinnedNoteHeight: (id: string, height: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Local width/height so dragging feels instant -- re-synced from the
  // saved note.boardWidth/boardHeight whenever either changes (a fresh
  // revalidate after saving, or a different device's resize coming
  // through), same "local copy, re-synced on prop change" pattern as
  // orderedNotes below. Not touched by anything but its own resize;
  // reorder/drag doesn't read or set either. Height stays undefined
  // (auto) until a height drag actually happens -- unlike width, which
  // always has a real pixel value even at its default.
  const [width, setWidth] = useState(note.boardWidth ?? DEFAULT_BOARD_NOTE_WIDTH);
  const [height, setHeight] = useState<number | undefined>(note.boardHeight);
  useEffect(() => {
    setWidth(note.boardWidth ?? DEFAULT_BOARD_NOTE_WIDTH);
  }, [note.boardWidth]);
  useEffect(() => {
    setHeight(note.boardHeight);
  }, [note.boardHeight]);
  const widthDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const heightDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  function handleWidthPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    widthDragRef.current = { startX: e.clientX, startWidth: width };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  function handleWidthPointerMove(e: React.PointerEvent) {
    if (!widthDragRef.current) return;
    const next = Math.max(MIN_BOARD_NOTE_WIDTH, Math.min(MAX_BOARD_NOTE_WIDTH, widthDragRef.current.startWidth + (e.clientX - widthDragRef.current.startX)));
    setWidth(next);
  }

  // Saving always runs first -- releasePointerCapture can throw (a
  // stale/already-released pointer, browser quirks) and, ordered
  // before the save, would silently skip persisting the drag entirely
  // if it did. Wrapped in try/catch too since its outcome doesn't
  // matter to the save either way.
  function handleWidthPointerUp(e: React.PointerEvent) {
    if (!widthDragRef.current) return;
    widthDragRef.current = null;
    resizePinnedNoteWidth(note.id, width);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  function handleHeightPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Height starts "auto" -- the first drag needs the card's actual
    // rendered height as its starting point, not `height` itself
    // (still undefined at that point).
    const startHeight = height ?? cardRef.current?.getBoundingClientRect().height ?? MIN_BOARD_NOTE_HEIGHT;
    heightDragRef.current = { startY: e.clientY, startHeight };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  function handleHeightPointerMove(e: React.PointerEvent) {
    if (!heightDragRef.current) return;
    const next = Math.max(MIN_BOARD_NOTE_HEIGHT, Math.min(MAX_BOARD_NOTE_HEIGHT, heightDragRef.current.startHeight + (e.clientY - heightDragRef.current.startY)));
    setHeight(next);
  }

  // Same ordering fix as handleWidthPointerUp -- save before the
  // best-effort releasePointerCapture, not after.
  function handleHeightPointerUp(e: React.PointerEvent) {
    if (!heightDragRef.current) return;
    heightDragRef.current = null;
    resizePinnedNoteHeight(note.id, height ?? MIN_BOARD_NOTE_HEIGHT);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
  }

  return (
    <div
      ref={cardRef}
      draggable={reorderMode}
      onDragStart={reorderMode ? onDragStart : undefined}
      onDragOver={reorderMode ? onDragOver : undefined}
      onDrop={reorderMode ? onDrop : undefined}
      onDragEnd={reorderMode ? onDragEnd : undefined}
      className={`note-card relative shrink-0 rounded-md border p-3 shadow-md ${!note.padColor ? "bg-record-background" : ""} ${
        isDragging ? "opacity-40" : ""
      } ${reorderMode ? "cursor-grab active:cursor-grabbing" : ""} ${height != null ? "overflow-y-auto" : ""}`}
      style={{
        width,
        height,
        backgroundColor: note.padColor || undefined,
      }}
    >
      {!reorderMode && (
        <>
          <div
            onPointerDown={handleWidthPointerDown}
            onPointerMove={handleWidthPointerMove}
            onPointerUp={handleWidthPointerUp}
            title="Drag to stretch this note's width"
            className="absolute -right-1 top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-foreground/15 hover:bg-foreground/30"
          />
          <div
            onPointerDown={handleHeightPointerDown}
            onPointerMove={handleHeightPointerMove}
            onPointerUp={handleHeightPointerUp}
            title="Drag to stretch this note's height"
            className="absolute -bottom-1 left-1/2 h-2 w-10 -translate-x-1/2 cursor-ns-resize touch-none rounded-full bg-foreground/15 hover:bg-foreground/30"
          />
        </>
      )}
      {reorderMode ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GripVertical className="h-4 w-4 flex-none" />
          <span className="truncate text-sm">{note.text.replace(/<[^>]+>/g, " ").trim() || "(empty note)"}</span>
        </div>
      ) : (
        <>
          <div className="absolute right-2 top-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Note options"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            >
              ⋮
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-10 w-32 rounded-md border bg-white py-1 text-xs shadow-lg">
                <button
                  type="button"
                  onClick={() => onReturnToList(note.id)}
                  className="block w-full px-3 py-1.5 text-left text-foreground hover:bg-muted"
                >
                  ↩ Unpin
                </button>
              </div>
            )}
          </div>
          <div className="pr-4">
            <NoteCardContent note={note} showAuthor={note.author !== currentUserName} />
            {(note.sharedWith || []).length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Shared with: {(note.sharedWith || []).map((name) => `${name}${(note.ackBy || []).includes(name) ? " ✓" : ""}`).join(", ")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PrivateNotesBoard({
  notes,
  currentUserName,
  pinPrivateNote,
  reorderPinnedNotes,
  unpinPrivateNote,
  resizePinnedNoteWidth,
  resizePinnedNoteHeight,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  pinPrivateNote: (id: string) => Promise<void>;
  reorderPinnedNotes: (orderedIds: string[]) => void;
  unpinPrivateNote: (id: string) => void;
  resizePinnedNoteWidth: (id: string, width: number) => void;
  resizePinnedNoteHeight: (id: string, height: number) => void;
}) {
  const sorted = [...notes].sort((a, b) => (a.boardZ ?? 0) - (b.boardZ ?? 0));

  // A local copy the drag handlers reorder instantly, then re-synced
  // from `notes` whenever it changes -- same pattern as
  // components/checklist-card.tsx's own orderedItems.
  const [orderedNotes, setOrderedNotes] = useState(sorted);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  useEffect(() => {
    setOrderedNotes(sorted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const next = [...orderedNotes];
    const fromIndex = next.findIndex((n) => n.id === draggedId);
    const toIndex = next.findIndex((n) => n.id === targetId);
    setDraggedId(null);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedNotes(next);
    reorderPinnedNotes(next.map((n) => n.id));
  }

  function handleBoardDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/note-id");
    if (id) pinPrivateNote(id);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {reorderMode ? "Drag notes to reorder them." : "Click 📌 Pin to board on a note in the list (or drag it here) to pin it."}
        </p>
        {orderedNotes.length > 1 && (
          <Button type="button" variant="outline" size="xs" onClick={() => setReorderMode((v) => !v)}>
            {reorderMode ? "Done" : "Reorder"}
          </Button>
        )}
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleBoardDrop}
        // 500px, up from 200px -- Michelle asked for a taller board, so
        // there's real room for several rows of notes before you have
        // to scroll, not just a sliver that happened to fit one row.
        className="flex min-h-[500px] flex-wrap content-start gap-3 rounded-md border p-4"
        style={{ backgroundColor: "#f0ede4" }}
      >
        {orderedNotes.length === 0 && (
          <p className="text-sm text-muted-foreground">Drag a note from the list onto this board to pin it.</p>
        )}
        {orderedNotes.map((n) => (
          <BoardNote
            key={n.id}
            note={n}
            currentUserName={currentUserName}
            reorderMode={reorderMode}
            isDragging={draggedId === n.id}
            onDragStart={() => setDraggedId(n.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(n.id)}
            onDragEnd={() => setDraggedId(null)}
            onReturnToList={unpinPrivateNote}
            resizePinnedNoteWidth={resizePinnedNoteWidth}
            resizePinnedNoteHeight={resizePinnedNoteHeight}
          />
        ))}
      </div>
    </div>
  );
}
