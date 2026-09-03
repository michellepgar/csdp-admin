-- Phase 20: fold "Communication Access" into the vas table as a
-- per-person checkbox, same shape as the existing `admin` column,
-- instead of a single settings row that could only ever name one
-- person at a time.

alter table vas
  add column if not exists communication_access boolean not null default false;

-- Backfill: whoever currently holds the single "communicationEditor"
-- setting keeps their access, carried over onto the new column.
update vas
set communication_access = true
where name = (
  select value->>'value'
  from settings
  where key = 'communicationEditor'
);
