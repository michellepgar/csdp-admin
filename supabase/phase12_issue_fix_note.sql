-- Phase 12: replace the Correction/Charting "Fix" sign-off chips with a
-- free-text note field.
-- Run this once in the Supabase SQL Editor, then let Claude know
-- ("done") so the matching app code can be deployed.

alter table issues
  add column if not exists fix_note text not null default '';

-- fixed_by (the old sign-off list) is left in place, unused -- no data
-- loss, same treatment as other retired columns in this app.
