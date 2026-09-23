-- phase72_plan_item_note_set_null.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn.
--
-- plan_items.note_id used "on delete cascade" (phase45_priority_linking.sql),
-- so deleting a private note silently deleted the reminder built from it too
-- -- including one already Started and showing "In Progress" on Currently
-- Working On, which would just vanish mid-flight with no warning. The
-- reminder's label was already copied from the note at creation time (see
-- addNoteToPlan/addPrivateNote's own comments), so it doesn't need the note
-- to keep displaying -- this switches the note going away to just detach
-- the link (note_id becomes null, same as it already handles gracefully:
-- the reminder shows its plain label instead of a link to open the note)
-- rather than deleting the reminder itself.

alter table plan_items drop constraint if exists plan_items_note_id_fkey;
alter table plan_items
  add constraint plan_items_note_id_fkey
  foreign key (note_id) references private_notes(id) on delete set null;
