# Private Notes Pinboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a freeform "pinboard" to the right half of the Private Notes page, where notes can be dragged out of the existing list, positioned anywhere, resized, rotated, and stacked — and dragged back to return to the list.

**Architecture:** Six new nullable columns on `private_notes` (`board_x/y/rotation/width/height/z`) make "is this note on the board" a pure function of `board_x` being non-null — no separate flag. `app/(app)/private-notes/page.tsx` splits into two columns: the existing list (filtered to `boardX == null`) on the left, a new `PrivateNotesBoard` (filtered to `boardX != null`) on the right. Native HTML5 drag-and-drop moves a note between the two zones; once on the board, `react-moveable` handles drag/resize/rotate within it. Both list and board reuse one extracted `NoteCardContent` component for the actual note body so the rich-text rendering never has two copies.

**Tech Stack:** Next.js 16 Server Actions, Supabase Postgres, `react-moveable` (new dependency), native HTML5 Drag and Drop API.

**Note on testing:** This project has no unit test framework configured (verified: no `test` script in `package.json`, no `*.test.*`/`*.spec.*` files). Every feature this session has instead been verified via `npm run build` (catches type/compile errors) plus live manual verification in the Browser pane using demo-mode login. This plan follows that same established convention rather than introducing a new one.

---

### Task 1: Database migration (handoff to Michelle)

**Files:**
- Create: `supabase/phase27_private_notes_board.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 27: freeform "pinboard" positions for Private Notes.
-- A note is "on the board" iff board_x is non-null -- no separate
-- boolean flag, so the two states can never drift out of sync.
alter table private_notes
  add column if not exists board_x numeric,
  add column if not exists board_y numeric,
  add column if not exists board_rotation numeric,
  add column if not exists board_width numeric,
  add column if not exists board_height numeric,
  add column if not exists board_z integer;
```

No RLS changes are needed — `private_notes` already has its team-member policy from `supabase/phase3_relational_notes.sql`, and these are just new nullable columns on the same table.

- [ ] **Step 2: Send the migration to Michelle and wait for confirmation**

Paste the SQL above as an inline code block in chat, and also send the file itself via `SendUserFile`. Ask her to run it in the Supabase SQL editor for the `jqsqstjmfsqqrnoxpuvn` project, and wait for her explicit confirmation ("done", "ran it", etc.) before starting Task 3 (the fetch layer) or Task 4 (the Server Actions) — both read/write these columns and will fail against the old schema. Tasks 2, 5, and 6 (TypeScript types, the npm dependency, and the new `NoteCardContent` extraction) don't touch the database and can be done first while waiting.

---

### Task 2: `PrivateNote` type additions

**Files:**
- Modify: `lib/app-state.ts:254-263`

- [ ] **Step 1: Add the six optional board fields to the interface**

Find the existing `PrivateNote` interface:

```typescript
export interface PrivateNote {
  id: string;
  /** See GeneralNote's own `text` comment -- same sanitized-HTML shape. */
  text: string;
  padColor?: string;
  author: string;
  sharedWith?: string[];
  ackBy?: string[];
  createdAt: string;
}
```

Replace it with:

```typescript
export interface PrivateNote {
  id: string;
  /** See GeneralNote's own `text` comment -- same sanitized-HTML shape. */
  text: string;
  padColor?: string;
  author: string;
  sharedWith?: string[];
  ackBy?: string[];
  createdAt: string;
  /** Position on the freeform pinboard (components/private-notes-board.tsx).
   *  Non-null boardX means this note lives on the board instead of the
   *  ordered list -- this is the ONLY signal used to decide that; there
   *  is no separate "isPinned" flag, so the two can't drift apart. */
  boardX?: number;
  boardY?: number;
  /** Degrees, e.g. -6 to 6 for the initial pin, freely adjustable after. */
  boardRotation?: number;
  /** Pixels. Undefined means "render at the board's default note size". */
  boardWidth?: number;
  boardHeight?: number;
  /** Stacking order -- higher draws on top. Recomputed server-side to
   *  current-max-plus-one whenever a note is touched, never client-set. */
  boardZ?: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds (this is an additive, all-optional change — nothing else references these fields yet).

- [ ] **Step 3: Commit**

```bash
git add lib/app-state.ts
git commit -m "feat(private-notes): add pinboard fields to PrivateNote type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Fetch layer mapping

**Depends on:** Task 1 confirmed run by Michelle (this task reads the new columns from the database).

**Files:**
- Modify: `lib/fetch-app-state.ts:157-178` (the `PrivateNoteRow` type and `mapPrivateNoteRow`)
- Modify: `lib/fetch-app-state.ts:543` (the `private_notes` select query)

- [ ] **Step 1: Extend `PrivateNoteRow` and the mapper**

Find:

```typescript
type PrivateNoteRow = {
  id: string;
  text: string;
  author: string;
  shared_with: string[];
  ack_by: string[];
  created_at: string;
  pad_color: string | null;
};

function mapPrivateNoteRow(r: PrivateNoteRow): PrivateNote {
  return {
    id: r.id,
    text: r.text,
    padColor: r.pad_color ?? undefined,
    author: r.author,
    sharedWith: r.shared_with,
    ackBy: r.ack_by,
```

Replace with:

```typescript
type PrivateNoteRow = {
  id: string;
  text: string;
  author: string;
  shared_with: string[];
  ack_by: string[];
  created_at: string;
  pad_color: string | null;
  board_x: number | null;
  board_y: number | null;
  board_rotation: number | null;
  board_width: number | null;
  board_height: number | null;
  board_z: number | null;
};

function mapPrivateNoteRow(r: PrivateNoteRow): PrivateNote {
  return {
    id: r.id,
    text: r.text,
    padColor: r.pad_color ?? undefined,
    author: r.author,
    sharedWith: r.shared_with,
    ackBy: r.ack_by,
    boardX: r.board_x ?? undefined,
    boardY: r.board_y ?? undefined,
    boardRotation: r.board_rotation ?? undefined,
    boardWidth: r.board_width ?? undefined,
    boardHeight: r.board_height ?? undefined,
    boardZ: r.board_z ?? undefined,
```

(Leave the rest of the function — the `createdAt: r.created_at,` line and closing brace — exactly as-is; this only adds fields before it.)

- [ ] **Step 2: Add the new columns to the select query**

Find (`lib/fetch-app-state.ts:543`):

```typescript
    supabase.from("private_notes").select("id, text, author, shared_with, ack_by, created_at, pad_color").order("created_at"),
```

Replace with:

```typescript
    supabase.from("private_notes").select("id, text, author, shared_with, ack_by, created_at, pad_color, board_x, board_y, board_rotation, board_width, board_height, board_z").order("created_at"),
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/fetch-app-state.ts
git commit -m "feat(private-notes): fetch pinboard columns from private_notes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Server Actions

**Depends on:** Task 1 confirmed run by Michelle.

**Files:**
- Modify: `app/(app)/private-notes/actions.ts`

- [ ] **Step 1: Add three new exported actions to the end of the file**

Append after the existing `removePrivateNote` function:

```typescript
/* A note is visible to (and thus board-manageable by) its author or
   anyone it's shared with -- same rule as visiblePrivateNotes() in
   lib/app-state.ts. Both people see the same note on their own
   Private Notes page, so either should be able to reposition it on
   their own board. */
function canManageBoardState(note: { author: string; shared_with: string[] | null }, currentName: string) {
  return note.author === currentName || (note.shared_with || []).includes(currentName);
}

/* Pins a note to the board at the given coordinates: sets its
   position, gives it a small randomized tilt so pinned notes don't
   look robotically aligned, and brings it to the front (highest
   board_z among ALL private_notes rows -- simplest to compute, and
   correct regardless of which subset of notes any one viewer can
   actually see, since z-index only ever matters relative to what's
   rendered together in one person's own board). */
export async function pinPrivateNote(id: string, x: number, y: number) {
  const rotation = Math.random() * 12 - 6; // -6..6 degrees

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (!note) return;
      const maxZ = Math.max(0, ...(state.privateNotes || []).map((n) => n.boardZ || 0));
      note.boardX = x;
      note.boardY = y;
      note.boardRotation = rotation;
      note.boardWidth = undefined;
      note.boardHeight = undefined;
      note.boardZ = maxZ + 1;
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { data: maxZRow } = await supabase
    .from("private_notes")
    .select("board_z")
    .not("board_z", "is", null)
    .order("board_z", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextZ = (maxZRow?.board_z || 0) + 1;

  const { error } = await supabase
    .from("private_notes")
    .update({ board_x: x, board_y: y, board_rotation: rotation, board_width: null, board_height: null, board_z: nextZ })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Flexible updater for everything that can happen to a note ONCE it's
   already on the board: dragging, resizing, rotating, or simply being
   touched (bringToFront). Only ever changes the fields present in
   `patch` -- e.g. a drag-end call only patches x/y, never touching
   width/height/rotation. Silently no-ops if the note isn't on the
   board (board_x is null) -- see the spec's documented limitation. */
export async function updatePrivateNoteBoardState(
  id: string,
  patch: { x?: number; y?: number; rotation?: number; width?: number; height?: number; bringToFront?: boolean }
) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (!note || note.boardX == null) return;
      if (patch.x !== undefined) note.boardX = patch.x;
      if (patch.y !== undefined) note.boardY = patch.y;
      if (patch.rotation !== undefined) note.boardRotation = patch.rotation;
      if (patch.width !== undefined) note.boardWidth = patch.width;
      if (patch.height !== undefined) note.boardHeight = patch.height;
      if (patch.bringToFront) {
        const maxZ = Math.max(0, ...(state.privateNotes || []).map((n) => n.boardZ || 0));
        note.boardZ = maxZ + 1;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with, board_x").eq("id", id).maybeSingle();
  if (!note || note.board_x == null || !canManageBoardState(note, me.name)) return;

  const update: Record<string, number | null> = {};
  if (patch.x !== undefined) update.board_x = patch.x;
  if (patch.y !== undefined) update.board_y = patch.y;
  if (patch.rotation !== undefined) update.board_rotation = patch.rotation;
  if (patch.width !== undefined) update.board_width = patch.width;
  if (patch.height !== undefined) update.board_height = patch.height;

  if (patch.bringToFront) {
    const { data: maxZRow } = await supabase
      .from("private_notes")
      .select("board_z")
      .not("board_z", "is", null)
      .order("board_z", { ascending: false })
      .limit(1)
      .maybeSingle();
    update.board_z = (maxZRow?.board_z || 0) + 1;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from("private_notes").update(update).eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}

/* Returns a note from the board to the ordinary list by clearing all
   six board columns -- this is the "drag it back" gesture. */
export async function unpinPrivateNote(id: string) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const note = (state.privateNotes || []).find((n) => n.id === id);
      if (note) {
        note.boardX = undefined;
        note.boardY = undefined;
        note.boardRotation = undefined;
        note.boardWidth = undefined;
        note.boardHeight = undefined;
        note.boardZ = undefined;
      }
    });
    revalidatePath("/private-notes");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: note } = await supabase.from("private_notes").select("author, shared_with").eq("id", id).maybeSingle();
  if (!note || !canManageBoardState(note, me.name)) return;

  const { error } = await supabase
    .from("private_notes")
    .update({ board_x: null, board_y: null, board_rotation: null, board_width: null, board_height: null, board_z: null })
    .eq("id", id);
  orThrow(error);
  revalidatePath("/private-notes");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manually verify in demo mode**

Demo mode doesn't need Task 1's migration (it operates on an in-memory `AppState`, not the real database), so this can be checked even before Michelle confirms the migration. Log in to the demo, but since the UI for pinning doesn't exist until Task 8, this step is just: confirm `npm run build` succeeded and move on — full interactive verification happens in Task 9.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/private-notes/actions.ts"
git commit -m "feat(private-notes): add pin/unpin/update-board-state actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Add the `react-moveable` dependency

**Files:**
- Modify: `package.json`, `package-lock.json` (both updated by `npm install`)

- [ ] **Step 1: Install the package**

```bash
npm install react-moveable@0.56.0
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds (nothing imports it yet, but this confirms the install didn't break anything).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-moveable for the Private Notes pinboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Extract shared `NoteCardContent`

This pulls the rich-text note body (currently only in `private-notes-list.tsx`) into its own file so both the list and the new board render it identically, with one copy of the logic.

**Files:**
- Create: `components/note-card-content.tsx`
- Modify: `components/private-notes-list.tsx:1-10` (imports), `components/private-notes-list.tsx:8-10` (remove local `formatDateTime`), `components/private-notes-list.tsx:50-57` (use the new component)

- [ ] **Step 1: Create the shared component**

```typescript
// components/note-card-content.tsx
import type { PrivateNote } from "@/lib/app-state";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* The rendered body of a private note -- text + author/date byline.
   Shared between the ordered list (components/private-notes-list.tsx)
   and the freeform pinboard (components/private-notes-board.tsx) so
   the two never drift into rendering notes differently. */
export function NoteCardContent({ note }: { note: Pick<PrivateNote, "text" | "author" | "createdAt"> }) {
  return (
    <>
      {/* text is sanitized server-side (lib/sanitize-note-html.ts)
          before it's ever stored -- see private-notes/actions.ts's
          addPrivateNote -- so this is safe to render as-is. */}
      <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: note.text }} />
      <p className="mt-1 text-xs text-muted-foreground">
        {note.author} · {formatDateTime(note.createdAt)}
      </p>
    </>
  );
}
```

- [ ] **Step 2: Use it from `private-notes-list.tsx`**

Find the top of `components/private-notes-list.tsx`:

```typescript
"use client";

import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import type { PrivateNote } from "@/lib/app-state";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
```

Replace with:

```typescript
"use client";

import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import { NoteCardContent } from "@/components/note-card-content";
import type { PrivateNote } from "@/lib/app-state";
```

Then find this block further down (the note text + byline rendering):

```typescript
            {/* text is sanitized server-side (lib/sanitize-note-html.ts)
                before it's ever stored -- see private-notes/actions.ts's
                addPrivateNote -- so this is safe to render as-is. */}
            <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: n.text }} />
            <p className="mt-1 text-xs text-muted-foreground">
              {n.author} · {formatDateTime(n.createdAt)}
            </p>
```

Replace with:

```typescript
            <NoteCardContent note={n} />
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manually verify nothing visually changed**

Start the dev server, log in to demo mode, open Private Notes, confirm existing notes still render their text/author/date exactly as before (this step is a pure refactor — output must be byte-for-byte identical).

- [ ] **Step 5: Commit**

```bash
git add components/note-card-content.tsx components/private-notes-list.tsx
git commit -m "refactor(private-notes): extract shared NoteCardContent

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: List side — draggable notes + drop-to-unpin

**Files:**
- Modify: `components/private-notes-list.tsx`

- [ ] **Step 1: Add the `unpinPrivateNote` prop**

Find the component's props type:

```typescript
export function PrivateNotesList({
  notes,
  currentUserName,
  shareableVas,
  ackPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  shareableVas: string[];
  ackPrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
}) {
```

Replace with:

```typescript
export function PrivateNotesList({
  notes,
  currentUserName,
  shareableVas,
  ackPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
  unpinPrivateNote,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  shareableVas: string[];
  ackPrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
  unpinPrivateNote: (id: string) => void;
}) {
```

- [ ] **Step 2: Wrap the list in a drop zone and make each card draggable**

Find:

```typescript
  return (
    <div className="space-y-3">
      {sorted.map((n) => {
```

Replace with:

```typescript
  return (
    <div
      className="space-y-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/note-id");
        if (id) unpinPrivateNote(id);
      }}
    >
      {sorted.map((n) => {
```

Then find the card's opening tag:

```typescript
          <div
            key={n.id}
            className={`note-card rounded-md border p-3 ${!n.padColor ? "bg-record-background" : ""}`}
            style={n.padColor ? { backgroundColor: n.padColor } : undefined}
          >
```

Replace with:

```typescript
          <div
            key={n.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/note-id", n.id)}
            className={`note-card cursor-grab rounded-md border p-3 active:cursor-grabbing ${!n.padColor ? "bg-record-background" : ""}`}
            style={n.padColor ? { backgroundColor: n.padColor } : undefined}
          >
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: fails — `app/(app)/private-notes/page.tsx` doesn't pass `unpinPrivateNote` yet. This is expected; Task 9 wires the page. Confirm the *only* error is the missing prop on `<PrivateNotesList>` in `page.tsx`, then continue — don't fix `page.tsx` here, that's Task 9's job so each task stays about one file's responsibility.

- [ ] **Step 4: Commit**

```bash
git add components/private-notes-list.tsx
git commit -m "feat(private-notes): make list notes draggable, drop-to-unpin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: The board component

**Files:**
- Create: `components/private-notes-board.tsx`

- [ ] **Step 1: Write the board and its per-note wrapper**

```typescript
// components/private-notes-board.tsx
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
function BoardNote({ note, onPersist }: { note: PrivateNote; onPersist: PersistFn }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef({
    x: note.boardX ?? 0,
    y: note.boardY ?? 0,
    rotation: note.boardRotation ?? 0,
    width: note.boardWidth ?? DEFAULT_WIDTH,
    height: note.boardHeight ?? DEFAULT_HEIGHT,
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
        }}
      >
        <span
          aria-hidden
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/note-id", note.id)}
          title="Drag to return this note to the list"
          className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full bg-red-600 shadow active:cursor-grabbing"
        />
        <NoteCardContent note={note} />
        {saveError && <p className="mt-1 text-xs text-destructive">Couldn&apos;t save — try moving it again.</p>}
      </div>
      <Moveable
        target={targetRef}
        draggable
        resizable
        rotatable
        throttleDrag={0}
        throttleResize={0}
        throttleRotate={0}
        onDragStart={bringToFront}
        onDrag={({ target, left, top }: { target: HTMLElement | SVGElement; left: number; top: number }) => {
          current.current.x = left;
          current.current.y = top;
          (target as HTMLElement).style.left = `${left}px`;
          (target as HTMLElement).style.top = `${top}px`;
        }}
        onDragEnd={() => scheduleSave({ x: current.current.x, y: current.current.y })}
        onResizeStart={bringToFront}
        onResize={({
          target,
          width,
          height,
          drag,
        }: {
          target: HTMLElement | SVGElement;
          width: number;
          height: number;
          drag: { left: number; top: number };
        }) => {
          current.current.width = width;
          current.current.height = height;
          current.current.x = drag.left;
          current.current.y = drag.top;
          (target as HTMLElement).style.width = `${width}px`;
          (target as HTMLElement).style.height = `${height}px`;
          (target as HTMLElement).style.left = `${drag.left}px`;
          (target as HTMLElement).style.top = `${drag.top}px`;
        }}
        onResizeEnd={() =>
          scheduleSave({
            width: current.current.width,
            height: current.current.height,
            x: current.current.x,
            y: current.current.y,
          })
        }
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
}: {
  notes: PrivateNote[];
  pinPrivateNote: (id: string, x: number, y: number) => Promise<void>;
  updatePrivateNoteBoardState: PersistFn;
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
          Drag a note from the list onto this board to pin it anywhere you like.
        </p>
      )}
      {notes.map((n) => (
        <BoardNote key={n.id} note={n} onPersist={updatePrivateNoteBoardState} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds (this component isn't imported anywhere yet, but it must type-check on its own).

- [ ] **Step 3: Commit**

```bash
git add components/private-notes-board.tsx
git commit -m "feat(private-notes): add the freeform pinboard component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Wire the page into two columns

**Files:**
- Modify: `app/(app)/private-notes/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the full contents of `app/(app)/private-notes/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, visiblePrivateNotes } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { PrivateNotesList } from "@/components/private-notes-list";
import { PrivateNotesBoard } from "@/components/private-notes-board";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { SubmitButton } from "@/components/submit-button";
import {
  addPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  ackPrivateNote,
  removePrivateNote,
  pinPrivateNote,
  updatePrivateNoteBoardState,
  unpinPrivateNote,
} from "./actions";

export default async function PrivateNotesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const mine = visiblePrivateNotes(state, me.name);
  const listNotes = mine.filter((n) => n.boardX == null);
  const boardNotes = mine.filter((n) => n.boardX != null);

  return (
    <div>
      <PageHeader title="Private Notes" />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <form action={addPrivateNote} className="max-w-lg space-y-2">
              <StickyNoteComposer placeholder="Add a private note…" />
              <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
            </form>

            <PrivateNotesList
              notes={listNotes}
              currentUserName={me.name}
              shareableVas={state.vas.map((v) => v.name)}
              ackPrivateNote={ackPrivateNote}
              sharePrivateNote={sharePrivateNote}
              unsharePrivateNote={unsharePrivateNote}
              removePrivateNote={removePrivateNote}
              unpinPrivateNote={unpinPrivateNote}
            />
          </div>

          <div>
            <h2 className="mb-2">Pinboard</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Drag any note from the list onto the board to pin it anywhere — drag its pin back onto the list to return it.
            </p>
            <PrivateNotesBoard
              notes={boardNotes}
              pinPrivateNote={pinPrivateNote}
              updatePrivateNoteBoardState={updatePrivateNoteBoardState}
            />
          </div>
        </div>
      </PageBody>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds, with zero errors — this resolves the "missing `unpinPrivateNote` prop" error that Task 7 deliberately left in place.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/private-notes/page.tsx"
git commit -m "feat(private-notes): split the page into list + pinboard columns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Verification, deploy, sign-off (controller's own job — not dispatched)

This task is executed directly by whoever is running this plan (per this project's established pattern), not broken into engineer-facing checkbox steps, since it involves live judgment calls (reading screenshots, waiting on Michelle's response) rather than mechanical file edits.

- [ ] Start the dev server / preview and log in via demo mode.
- [ ] Open Private Notes. Confirm the page now shows two columns: the existing list on the left, a tan "Pinboard" area on the right.
- [ ] Drag an existing note from the list onto the board. Confirm: it disappears from the list, appears on the board near the drop point, tilted slightly, with a small red pin dot at the top.
- [ ] Drag the board note around. Confirm it moves smoothly and stays where dropped after releasing.
- [ ] Resize the board note using its handles. Confirm it resizes without jumping position.
- [ ] Rotate the board note using its rotate handle. Confirm it rotates smoothly.
- [ ] Drag a second note onto the board so it overlaps the first, then click/drag the first one again. Confirm it comes to the front (renders on top).
- [ ] Drag a board note's pin back onto the list area. Confirm it disappears from the board and reappears in the list.
- [ ] Reload the page. Confirm every board note's position, size, and rotation persisted exactly as left, and the list/board split is still correct.
- [ ] Take a screenshot showing the two-column layout with at least one pinned note, and share it with Michelle along with a summary of what was tested.
- [ ] Wait for Michelle's explicit confirmation before proceeding.
- [ ] Commit any final fixes needed from her feedback, then `git push origin main`.
- [ ] Poll `https://api.github.com/repos/michellepgar/csdp-admin/commits/<sha>/status` until `"state": "success"`.
- [ ] Report the live URL (`https://csdp-admin.vercel.app/private-notes`) back to Michelle.
