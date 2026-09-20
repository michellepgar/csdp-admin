-- phase63_priority_assigned_to.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- A Task Priority can be ASSIGNED to someone without being on their plan.
-- assigned_to says who it is for; va_name (unchanged) still means "this
-- person has grabbed it and it's on their plan". So an assigned priority
-- stays in Task Priorities, showing who it's for, until that person grabs
-- it with Today or Next plan (they may not have room for it next shift).

alter table plan_items add column if not exists assigned_to text;
