-- phase45_priority_linking.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- 1) Lets a boss-added priority optionally carry a suggested
--    school/category/file-name, so PlanPriorityStartForm can pre-fill
--    the Start picker instead of starting blank.
-- 2) Adds plan_items.kind = 'note' for a private-note reminder pinned
--    into "Your Plan" -- note_id links back to the note, completed_at
--    marks when the reminder was checked off (the row is kept, not
--    deleted, so it can still be counted as "completed today").

alter table plan_items add column if not exists suggested_school_id text references schools(id) on delete set null;
alter table plan_items add column if not exists suggested_category_id text references task_categories(id) on delete set null;
alter table plan_items add column if not exists suggested_file_name text;
alter table plan_items add column if not exists note_id text references private_notes(id) on delete cascade;
alter table plan_items add column if not exists completed_at timestamptz;

alter table plan_items drop constraint if exists plan_items_kind_check;
alter table plan_items add constraint plan_items_kind_check check (kind in ('task', 'priority', 'note'));
