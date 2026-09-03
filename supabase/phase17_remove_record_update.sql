-- phase17_remove_record_update.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn.
--
-- Michelle asked to remove the "Record Update" issue type from Issues
-- & Concerns entirely, including any existing records of that type
-- (confirmed explicitly, not just hiding the option going forward).
-- The `issues` table itself is untouched -- its record_update-only
-- columns (student_name, dob, insurance_number, school_year,
-- file_name, page_number, correcting_category, correct_info) are left
-- in place, just permanently unused, same as any other nullable
-- column nothing writes to anymore. Run this BEFORE deploying the app
-- code that removes the "Record Update" type/UI.

delete from issues where type = 'record_update';
