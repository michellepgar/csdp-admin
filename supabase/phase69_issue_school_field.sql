-- phase69_issue_school_field.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Review Info (Issues & Concerns' old "Correction / Verification" type,
-- simplified per Michelle: drop the Kind picker and "needs correction"
-- checkboxes, add a plain School field) needs somewhere to store which
-- school a record is about. A plain text field, not a reference to the
-- schools table -- Michelle wants it freely typed, not picked from a list.

alter table issues
  add column if not exists school text;
