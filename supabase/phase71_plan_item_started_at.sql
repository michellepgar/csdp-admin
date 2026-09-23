-- phase71_plan_item_started_at.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn.
--
-- Reminders on Your Plan get a "Start" button like tasks already have.
-- A reminder has no underlying task row to flip to "In Progress", so
-- this column on the plan_items row itself is what marks it started --
-- the row is kept (not deleted, unlike starting a task) so it can still
-- show up on Currently Working On until it's completed there.

alter table plan_items
  add column if not exists started_at timestamptz;
