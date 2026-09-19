-- phase52_priority_assignment_notifications.sql — run once in Supabase's
-- SQL Editor for project jqsqstjmfsqqrnoxpuvn.
--
-- The notification bell (built for @mentions, phase47) now also tells a
-- VA when a Task Priority is assigned to them. Same table, one new
-- `source` value: 'priority_assignment' (the priority's label is stored
-- in `snippet`; there's no issue/note to link back to, so both id
-- columns stay null). Existing rows are untouched.

alter table mentions drop constraint if exists mentions_source_check;
alter table mentions
  add constraint mentions_source_check
  check (source in ('issue_comment', 'general_note', 'priority_assignment'));
