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
