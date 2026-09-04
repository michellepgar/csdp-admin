-- phase23_note_pad_color.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE the app code that reads/writes
-- this column is deployed.

-- General Notes and Private Notes can now be given a sticky-note pad
-- color, chosen from a fixed list the app enforces
-- (NOTE_PAD_COLORS in lib/app-state.ts) -- not a foreign key, same
-- reasoning as general_tasks' own plain `category` column.
alter table general_notes add column pad_color text;
alter table private_notes add column pad_color text;
