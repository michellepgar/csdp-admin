-- phase77_meetings.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Safe to run again.
--
-- Lets a plan item be a meeting (logged from Your Plan's "I'm in a meeting").
-- A meeting uses the same started_at / completed_at columns reminders use.

alter table plan_items drop constraint if exists plan_items_kind_check;
alter table plan_items add constraint plan_items_kind_check check (kind in ('task', 'priority', 'note', 'meeting'));
