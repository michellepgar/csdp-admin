-- phase60_priority_order.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn.
--
-- Lets the admins put Task Priorities in order. sort_order is 0 for the top
-- priority, 1 for the next, and so on; priorities that were never ordered
-- (null) sit below the ordered ones, oldest first.

alter table plan_items add column if not exists sort_order integer;
