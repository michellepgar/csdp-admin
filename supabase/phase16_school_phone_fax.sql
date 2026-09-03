-- phase16_school_phone_fax.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE deploying the app code that
-- reads/writes schools.phone/fax.
--
-- Splits phone/fax out of the free-text "hours" block (Michelle's
-- original example had them as the first two lines of that block) into
-- their own columns, so they render on the school page as their own
-- labeled fields instead of just whatever line order was typed into
-- Hours. No RLS/grant changes needed -- `schools` already has both from
-- phase1_relational_team_schools.sql.

alter table schools add column if not exists phone text;
alter table schools add column if not exists fax text;
