-- Phase 33: student identity + visit tracking on redcap_tallies, for
-- REDCap v2's per-student dedup -- a student seen at both the Initial
-- and Follow-up visits should be ONE row, not two. See
-- docs/superpowers/specs/2026-09-09-redcap-v2-student-dedup-design.md.
--
-- All five columns are nullable: historical rows have none of this
-- and are left as NULL, not backfilled. The app enforces Name as
-- required for NEW entries in its own UI validation, not a NOT NULL
-- constraint here (matches how required-ness is enforced everywhere
-- else in this app -- e.g. Consent/Insurance/etc. on this same table
-- are also nullable columns with app-level required validation).
alter table redcap_tallies
  add column if not exists student_name text,
  add column if not exists date_of_birth text,
  add column if not exists insurance_number text,
  add column if not exists seen_initial_date text,
  add column if not exists seen_follow_up_date text;
