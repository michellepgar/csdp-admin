-- phase64_task_assignment_notifications.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn.
--
-- The notification bell now also tells a VA when a task is assigned to them
-- on a school page. Same `mentions` table, one more `source` value:
-- 'task_assignment' (the file's name is stored in `snippet`).

alter table mentions drop constraint if exists mentions_source_check;
alter table mentions
  add constraint mentions_source_check
  check (source in ('issue_comment', 'general_note', 'priority_assignment', 'task_assignment'));
