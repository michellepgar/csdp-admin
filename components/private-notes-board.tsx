"use client";

import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteCardContent } from "@/components/note-card-content";
import type { PrivateNote } from "@/lib/app-state";

/* One note pinned to the board -- laid out in normal document flow
   (flex-wrap on the parent), not freely positioned. Free drag/resize/
   rotate (via react-moveable) was tried first but proved confusing in
   practice (an unreliable "move" gesture, notes draggable off-screen
   entirely) -- an ordered left-to-right layout you rearrange via the
   board's Reorder mode is simpler and has no equivalent failure mode.

   No rotation either -- pinPrivateNote (app/(app)/private-notes/actions.ts)
   used to give each note a small random decorative tilt, but Michelle
   asked for pinned notes to sit straight, so note.boardRotation is
   never read here anymore regardless of what's stored (an old note
   pinned before this change can still carry a nonzero value; ignoring
   it here straightens those out too, not just newly-pinned ones). */
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      draggable={reorderMode}
      onDragStart={reorderMode ? onDragStart : undefined}
      onDragOver={reorderMode ? onDragOver : undefined}
      onDrop={reorderMode ? onDrop : undefined}
      onDragEnd={reorderMode ? onDragEnd : undefined}
      className={`note-card relative w-48 shrink-0 rounded-md border p-3 shadow-md ${!note.padColor ? "bg-record-background" : ""} ${
        isDragging ? "opacity-40" : ""
      } ${reorderMode ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        backgroundColor: note.padColor || undefined,
      }}
    >
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
}: {
  notes: PrivateNote[];
  currentUserName: string;
  pinPrivateNote: (id: string) => Promise<void>;
  reorderPinnedNotes: (orderedIds: string[]) => void;
  unpinPrivateNote: (id: string) => void;
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
        className="flex min-h-[200px] flex-wrap gap-3 rounded-md border p-4"
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
          />
        ))}
      </div>
    </div>
  );
}
