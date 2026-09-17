-- phase44_plan_items_grants.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- phase43_daily_plan.sql created plan_items with RLS policies, but
-- missed the base table GRANT every other table in this app has
-- (e.g. task_file_categories, general_tasks) -- RLS only restricts
-- access an already-granted role has; without this grant, Postgres
-- refuses the authenticated role outright with "permission denied for
-- table plan_items" before RLS is even evaluated.

grant select, insert, update, delete on plan_items to authenticated;
