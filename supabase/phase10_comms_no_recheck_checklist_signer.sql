-- Phase 10: Communications sub-tracking on tasks, "No Recheck" per
-- school, and who-checked-it-off on checklist items.
-- Run this once in the Supabase SQL Editor, then let Claude know
-- ("done") so the matching app code can be deployed.

-- Initial/Recheck tasks get their own parallel Communications
-- status+signatures, tracked against the same file name rather than
-- a second task row.
alter table tasks
  add column if not exists comms_status text not null default '',
  add column if not exists comms_va_assigned text[] not null default '{}';

-- A school that doesn't need a second pass after Initial gets this
-- flipped on, which grays out its Recheck section on the school page.
alter table schools
  add column if not exists no_recheck boolean not null default false;

-- Anyone on the team can now check a Yearly Checklist item off (not
-- just the assigned VA); this records who actually did it, shown as a
-- small signature next to the item.
alter table checklist_progress
  add column if not exists checked_by text;
