-- Phase 28: optional file name per REDCap student entry, for internal
-- audit/mistake-tracking only -- never shown on the aggregated Report
-- tab, only in Review Entries (and the Flags panel, which reuses the
-- same row view).
alter table redcap_tallies
  add column if not exists file_name text;
