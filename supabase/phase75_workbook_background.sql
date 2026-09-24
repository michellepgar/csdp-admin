-- phase75_workbook_background.sql -- run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Lets each workbook choose its canvas background color and pattern.
-- Both columns are optional; empty means the default look.

alter table workbooks add column if not exists bg_color text;
alter table workbooks add column if not exists bg_style text;
