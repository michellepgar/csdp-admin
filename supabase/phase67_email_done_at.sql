-- phase67_email_done_at.sql -- run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn.
--
-- Remembers WHEN an Email Tracker item was marked Done, so it can show on
-- Overview's Currently Working On card as completed (like a finished task or a
-- reviewed reminder) instead of just disappearing. Nothing existing changes.

alter table email_tracker_items add column if not exists done_at timestamptz;
