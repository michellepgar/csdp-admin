"use client";

import { useEffect, useRef, useState } from "react";
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
  currentUserName,
  onPersist,
  onReturnToList,
  getBounds,
}: {
  note: PrivateNote;
  currentUserName: string;
  onPersist: PersistFn;
  onReturnToList: (id: string) => void;
  /** Current pixel size of the board container, or null before it's
   *  measured. Used to keep a note from ever landing somewhere the
   *  board's overflow-hidden clips it out of view entirely. */
  getBounds: () => { width: number; height: number } | null;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  // Moveable's own `dragTarget`/`rotationTarget` -- restricting drag/rotate
  // to just the note's body (not the whole target div) is what actually
  // keeps the pin button clickable. An earlier attempt used
  // stopPropagation on the pin's mousedown instead, which turned out NOT
  // to reliably beat Moveable's own listener; giving Moveable a narrower
  // target than the pin altogether sidesteps the race entirely.
  const dragAreaRef = useRef<HTMLDivElement>(null);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Closes the ⋮ menu on any click outside it -- otherwise it stays
  // open until Unpin is clicked, which is surprising once you've moved
  // on to look at (or drag) something else.
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  // Keeps a position inside the board's actual current size -- without
  // this, dragging (or a fast/large drag delta) past the edge put the
  // note somewhere the board's overflow-hidden clips out of view
  // entirely, with no way back to it (confirmed live: a note dragged
  // out was completely unreachable, pin and all).
  function clamp(x: number, y: number) {
    const bounds = getBounds();
    if (!bounds) return { x: Math.max(0, x), y: Math.max(0, y) };
    return {
      x: Math.min(Math.max(0, x), Math.max(0, bounds.width - current.current.width)),
      y: Math.min(Math.max(0, y), Math.max(0, bounds.height - current.current.height)),
    };
  }

  // Self-heals a note that's already stuck off-screen from before this
  // fix existed (or from any other stale/bad stored position) -- runs
  // once the board's real size is known, silently repositions it back
  // into view, and persists the corrected position so it stays fixed.
  useEffect(() => {
    const bounds = getBounds();
    if (!bounds) return;
    const clamped = clamp(current.current.x, current.current.y);
    if (clamped.x === current.current.x && clamped.y === current.current.y) return;
    current.current.x = clamped.x;
    current.current.y = clamped.y;
    applyFrameToTarget();
    onPersist(note.id, { x: clamped.x, y: clamped.y }).catch(() => {
      // Non-critical here too -- worst case it drifts back off-screen
      // and gets healed again on the next load.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div ref={menuRef} className="absolute right-2 top-2">
          <button
            type="button"
            title="Note options"
            onClick={() => setMenuOpen((v) => !v)}
            // Sits outside dragAreaRef below, so Moveable's drag never
            // starts from a mousedown here -- same reasoning as the old
            // pin button this replaced (see dragAreaRef's own comment).
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-black/5"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-10 w-32 rounded-md border bg-white py-1 text-xs shadow-lg">
              {/* Not a button -- there's no separate "move" action, this
                  is just a labeled reminder that dragging anywhere on
                  the note (the text area) repositions it. */}
              <p className="cursor-default px-3 py-1.5 text-muted-foreground" title="Drag the note itself to reposition it">
                ⠿ Move (drag note)
              </p>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReturnToList(note.id);
                }}
                className="block w-full px-3 py-1.5 text-left text-foreground hover:bg-muted"
              >
                ↩ Unpin
              </button>
            </div>
          )}
        </div>
        <div ref={dragAreaRef} className="pr-4">
          <NoteCardContent note={note} showAuthor={note.author !== currentUserName} />
          {/* Read-only -- the board is a compact view, so this shows who
              a note is shared with (and whether they've acknowledged it)
              the same as the list, without repeating the list's own
              share/unshare controls here. Manage sharing from the list
              (click the pin to send it back) if a change is needed. */}
          {(note.sharedWith || []).length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Shared with: {(note.sharedWith || []).map((name) => `${name}${(note.ackBy || []).includes(name) ? " ✓" : ""}`).join(", ")}
            </p>
          )}
        </div>
        {saveError && <p className="mt-1 text-xs text-destructive">Couldn&apos;t save — try moving it again.</p>}
      </div>
      <Moveable
        target={targetRef}
        dragTarget={dragAreaRef}
        draggable
        // Interactive rotation removed after live feedback -- the
        // handle-and-line control read as an unwanted "antenna" sticking
        // out of the note. Each note still gets its small random tilt
        // when pinned (current.current.rotation, set once in
        // pinPrivateNote), it just can't be adjusted afterward.
        throttleDrag={0}
        onDragStart={bringToFront}
        onDrag={({ target, left, top }: { target: HTMLElement | SVGElement; left: number; top: number }) => {
          const clamped = clamp(left, top);
          current.current.x = clamped.x;
          current.current.y = clamped.y;
          (target as HTMLElement).style.left = `${clamped.x}px`;
          (target as HTMLElement).style.top = `${clamped.y}px`;
        }}
        onDragEnd={() => scheduleSave({ x: current.current.x, y: current.current.y })}
      />
    </>
  );
}

export function PrivateNotesBoard({
  notes,
  currentUserName,
  pinPrivateNote,
  updatePrivateNoteBoardState,
  unpinPrivateNote,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  pinPrivateNote: (id: string, x: number, y: number) => Promise<void>;
  updatePrivateNoteBoardState: PersistFn;
  unpinPrivateNote: (id: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);

  function getBounds() {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/note-id");
    const board = boardRef.current;
    if (!id || !board) return;
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - DEFAULT_WIDTH / 2, rect.width - DEFAULT_WIDTH));
    const y = Math.max(0, Math.min(e.clientY - rect.top - 20, rect.height - DEFAULT_HEIGHT));
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
        <BoardNote
          key={n.id}
          note={n}
          currentUserName={currentUserName}
          onPersist={updatePrivateNoteBoardState}
          onReturnToList={unpinPrivateNote}
          getBounds={getBounds}
        />
      ))}
    </div>
  );
}
