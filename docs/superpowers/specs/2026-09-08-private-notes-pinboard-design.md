# Private Notes Pinboard — Design Spec

**Date:** 2026-09-08
**Status:** Approved by Michelle

## Summary

Add a freeform "pinboard" area to the right half of the Private Notes page. Notes can be dragged out of the existing ordered list onto this board, where they can be positioned anywhere, resized, rotated, and stacked (z-index), like a physical corkboard. Notes can be dragged back from the board into the list to "unpin" them. Private Notes only for now — General Notes is out of scope.

## Visual style

Chosen direction: **"D — Warm Flat Board"** from the visual companion round.

- No cork/linen texture — a solid warm off-white/tan background (distinct from the app's white background elsewhere, so the board reads as its own zone).
- Each note on the board renders as a tilted piece of "paper" (small randomized rotation) with a small colored circular "pin" centered at the top edge, using the note's existing pad color.
- Notes keep the same rich-text rendering (bold/italic/underline, font family/size/color, bullet/checklist lists) as the existing list view — the board is a different position/frame for the same note content, not a different note type.

## Page layout

`app/(app)/private-notes/page.tsx` splits into two halves:

- **Left half:** unchanged — existing composer (`StickyNoteComposer`) + `PrivateNotesList`, filtered to notes where `board_x` is null (i.e., not pinned to the board).
- **Right half:** new `components/private-notes-board.tsx`, rendering notes where `board_x` is not null, absolutely positioned within the board area per their `board_x`/`board_y`.

## Data model

New migration `supabase/phase27_private_notes_board.sql` adds six nullable columns to `private_notes`:

| Column | Type | Meaning |
|---|---|---|
| `board_x` | numeric | X position in pixels within the board container |
| `board_y` | numeric | Y position in pixels within the board container |
| `board_rotation` | numeric | Rotation in degrees, small range (-8 to 8 on initial pin, freely adjustable after via the rotate handle) |
| `board_width` | numeric | Width in pixels; null = default note width |
| `board_height` | numeric | Height in pixels; null = default note height |
| `board_z` | integer | Stacking order; higher draws on top |

**A note is "on the board" if and only if `board_x` is non-null.** No separate boolean flag — this single condition is the source of truth for both the list filter and the board filter, so it cannot drift out of sync.

`lib/app-state.ts`'s `PrivateNote` interface gains the six fields as optional (`boardX?`, `boardY?`, `boardRotation?`, `boardWidth?`, `boardHeight?`, `boardZ?`), following the same optional-field convention already used elsewhere on this interface. `lib/fetch-app-state.ts`'s private-notes row mapper maps the six new snake_case columns through to these camelCase fields.

## Interactions

**Moving a note onto the board:** list rows become `draggable`; the board container has an `onDrop` handler that reads the drop coordinates (relative to the board container) and calls the `pinPrivateNote` action.

**Moving a note off the board (back to the list):** board notes become `draggable`; the list container has an `onDrop` handler that calls `unpinPrivateNote`.

**Once on the board:** dragging, resizing, and rotating use `react-moveable` (new npm dependency) wrapped around each board note. Moveable's callbacks update local React state immediately for a responsive feel, and persist via `updatePrivateNoteBoardState`, debounced so a save fires only when the interaction pauses/ends — not on every intermediate frame of a drag.

**Bring to front:** starting any interaction (drag/resize/rotate) on a note bumps its `board_z` to `(current max board_z among the user's board notes) + 1`, so the note being touched always comes to front. This recomputes only the touched note's z — it never reshuffles other notes.

## Server actions

Added to `app/(app)/private-notes/actions.ts`, following the existing demo-mode-aware pattern (`isDemoMode()`/`demoMutate()` branch, then the real Supabase branch) used by every other action in this file:

- `pinPrivateNote(id: string, x: number, y: number)` — sets `board_x`/`board_y` to the given coordinates, `board_z` to current-max-plus-one, `board_rotation` to a randomized value between -6 and 6 degrees. Leaves width/height null (renders at default size).
- `updatePrivateNoteBoardState(id: string, patch: { x?: number; y?: number; rotation?: number; width?: number; height?: number; bringToFront?: boolean })` — single flexible updater for all post-pin interactions; when `bringToFront` is true, resolves `board_z` server-side to current-max-plus-one rather than trusting a client-supplied z.
- `unpinPrivateNote(id: string)` — nulls out all six board columns.

All three re-check that the note belongs to the current user (same ownership check already used by the existing `removePrivateNote`/`ackPrivateNote` actions) before mutating.

## Error handling

If a board-state save fails (e.g. a network blip mid-drag), the client reverts the note to its last known-good position/size/rotation (already held in local state) and shows a brief inline error message. No silent data loss, no crash — the user can simply try the interaction again.

## Out of scope (explicitly deferred)

- General Notes (shared/team page) does not get the pinboard — Private Notes only.
- No multi-select or bulk board actions.
- No board "zoom" or infinite-canvas panning — the board is a fixed-size area matching the right half of the page.

## Verification plan

Before deploying: verify live in the Browser pane via demo-mode login — drag a note onto the board, resize it, rotate it, drag a second note on top of it to confirm stacking/z-index, drag a note back to the list, and reload the page to confirm all board state persisted correctly. Screenshot and walk through it live with Michelle before pushing to production, matching this project's established "show me before deploying" pattern.
