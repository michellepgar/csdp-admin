"use client";

import { useRef, useState } from "react";
import Moveable from "react-moveable";
import { NoteCardContent } from "@/components/note-card-content";
import type { PrivateNote } from "@/lib/app-state";

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 140;
const SAVE_DEBOUNCE_MS = 400;

type BoardPatch = { x?: number; y?: number; rotation?: number; width?: number; height?: number; bringToFront?: boolean };
type PersistFn = (id: string, patch: BoardPatch) => Promise<void>;

/* One note pinned to the board. Drag/resize/rotate all come from
   react-moveable, which fires its onDrag/onResize/onRotate callbacks
   on every animation frame -- far too often to round-trip through
   React state (and doing so would fight Moveable for control of the
   target element's own styles). Instead, `current` is a plain ref
   that those callbacks write to directly and read back from when it's
   time to persist (on *End) or revert (on a failed save). The only
   time this component re-renders itself is right after a revert, via
   `frameVersion`, so the JSX picks up the reverted values. */
function BoardNote({
  note,
  onPersist,
  onReturnToList,
}: {
  note: PrivateNote;
  onPersist: PersistFn;
  onReturnToList: (id: string) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resizing was removed after live use showed it wasn't wanted -- every
  // note keeps its default size on the board. boardWidth/boardHeight stay
  // in the data model (a note pinned before this change may still carry
  // an old custom size, which this simply ignores) so no migration or
  // backfill is needed.
  const current = useRef({
    x: note.boardX ?? 0,
    y: note.boardY ?? 0,
    rotation: note.boardRotation ?? 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const lastGood = useRef({ ...current.current });
  const [, setFrameVersion] = useState(0);
  const [saveError, setSaveError] = useState(false);

  function applyFrameToTarget() {
    const el = targetRef.current;
    if (!el) return;
    const f = current.current;
    el.style.left = `${f.x}px`;
    el.style.top = `${f.y}px`;
    el.style.width = `${f.width}px`;
    el.style.height = `${f.height}px`;
    el.style.transform = `rotate(${f.rotation}deg)`;
  }

  function scheduleSave(patch: BoardPatch) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onPersist(note.id, patch)
        .then(() => {
          lastGood.current = { ...current.current };
          setSaveError(false);
        })
        .catch(() => {
          current.current = { ...lastGood.current };
          applyFrameToTarget();
          setSaveError(true);
          setFrameVersion((v) => v + 1);
        });
    }, SAVE_DEBOUNCE_MS);
  }

  function bringToFront() {
    onPersist(note.id, { bringToFront: true }).catch(() => {
      // Non-critical -- a missed z-index bump isn't worth reverting
      // position over, and the note is still fully usable either way.
    });
  }

  return (
    <>
      <div
        ref={targetRef}
        className={`note-card absolute rounded-md border p-3 shadow-md ${!note.padColor ? "bg-record-background" : ""}`}
        style={{
          left: current.current.x,
          top: current.current.y,
          width: current.current.width,
          height: current.current.height,
          transform: `rotate(${current.current.rotation}deg)`,
          backgroundColor: note.padColor || undefined,
          // boardZ is always read from the fresh `note` prop, never the
          // `current` ref -- it's server-authoritative (bringToFront
          // resolves it from the database's current max), and a new
          // value only ever arrives via revalidatePath re-rendering
          // this component with an updated note.boardZ.
          zIndex: note.boardZ ?? 0,
        }}
      >
        <span
          aria-hidden
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/note-id", note.id)}
          title="Drag to return this note to the list"
          // Off in the top-left corner, not top-center -- top-center is
          // where Moveable's own rotate handle and its connecting line
          // render, and the two sitting on top of each other is what
          // read as "the pin is on the line we drag" in feedback. Inset
          // from the corner (not flush with the edge) so it reads as
          // pinned INTO the paper rather than clipped at its border.
          className="absolute left-3 top-3 h-3 w-3 cursor-grab rounded-full bg-red-600 shadow active:cursor-grabbing"
        />
        <NoteCardContent note={note} />
        <button
          type="button"
          title="Return this note to the list"
          // Moveable starts its own drag from a mousedown on this same
          // target element -- stopping propagation here keeps a plain
          // click on this button from also being interpreted as the
          // start of a board drag.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onReturnToList(note.id)}
          className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ↩ Return to list
        </button>
        {saveError && <p className="mt-1 text-xs text-destructive">Couldn&apos;t save — try moving it again.</p>}
      </div>
      <Moveable
        target={targetRef}
        draggable
        rotatable
        // Hides the small circle Moveable renders at the note's center
        // by default -- it's the rotation transform-origin marker, which
        // isn't useful here and read as an unexplained decoration.
        origin={false}
        throttleDrag={0}
        throttleRotate={0}
        onDragStart={bringToFront}
        onDrag={({ target, left, top }: { target: HTMLElement | SVGElement; left: number; top: number }) => {
          current.current.x = left;
          current.current.y = top;
          (target as HTMLElement).style.left = `${left}px`;
          (target as HTMLElement).style.top = `${top}px`;
        }}
        onDragEnd={() => scheduleSave({ x: current.current.x, y: current.current.y })}
        onRotateStart={bringToFront}
        onRotate={({ target, rotate }: { target: HTMLElement | SVGElement; rotate: number }) => {
          current.current.rotation = rotate;
          (target as HTMLElement).style.transform = `rotate(${rotate}deg)`;
        }}
        onRotateEnd={() => scheduleSave({ rotation: current.current.rotation })}
      />
    </>
  );
}

export function PrivateNotesBoard({
  notes,
  pinPrivateNote,
  updatePrivateNoteBoardState,
  unpinPrivateNote,
}: {
  notes: PrivateNote[];
  pinPrivateNote: (id: string, x: number, y: number) => Promise<void>;
  updatePrivateNoteBoardState: PersistFn;
  unpinPrivateNote: (id: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/note-id");
    const board = boardRef.current;
    if (!id || !board) return;
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - DEFAULT_WIDTH / 2);
    const y = Math.max(0, e.clientY - rect.top - 20);
    pinPrivateNote(id, x, y);
  }

  return (
    <div
      ref={boardRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative min-h-[500px] w-full overflow-hidden rounded-md border"
      style={{ backgroundColor: "#f0ede4" }}
    >
      {notes.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          Click 📌 Pin to board on a note in the list (or drag it here) to pin it anywhere you like.
        </p>
      )}
      {notes.map((n) => (
        <BoardNote key={n.id} note={n} onPersist={updatePrivateNoteBoardState} onReturnToList={unpinPrivateNote} />
      ))}
    </div>
  );
}
