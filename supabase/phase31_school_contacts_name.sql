-- Phase 31: adds a name to each school_contacts entry, so a second
-- (or third) contact for a position -- e.g. a school with two nurses
-- -- can be told apart, not just listed by email.
alter table school_contacts
  add column if not exists name text;
