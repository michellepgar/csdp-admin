-- phase19_school_email_notes.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the app code that
-- reads/writes schools.email_notes.
--
-- Michelle asked for a new "Email Notes" section next to Email Tracker
-- on the school page: one free-text note per school, always visible,
-- anyone on the team can edit -- same "just a column on schools"
-- pattern as website/phone/fax/hours.

alter table schools add column if not exists email_notes text;
