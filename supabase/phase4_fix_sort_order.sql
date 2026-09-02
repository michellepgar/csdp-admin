-- phase4_fix_sort_order.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- Bug: task_categories, checklist_template, email_templates,
-- contact_groups, and contact_rows were all backfilled with a single
-- INSERT ... SELECT statement, so every row in each table got the
-- exact same created_at timestamp (Postgres's now() is stable for the
-- whole statement). Ordering by created_at then has no real tiebreak,
-- so a later UPDATE (e.g. renaming a contact group) can silently
-- reorder the whole list. Fix: a real sort_order column, backfilled
-- from each item's ORIGINAL position in the app_state blob's arrays
-- (still present there, untouched, even though nothing reads it back
-- out anymore) so the true original order is restored exactly once,
-- then stays fixed regardless of future edits.

-- "if not exists" makes this safe to re-run in case an earlier attempt
-- partially applied before failing on a later statement.
alter table task_categories add column if not exists sort_order integer;
alter table checklist_template add column if not exists sort_order integer;
alter table email_templates add column if not exists sort_order integer;
alter table contact_groups add column if not exists sort_order integer;
alter table contact_rows add column if not exists sort_order integer;

update task_categories t
set sort_order = sub.idx
from (
  select (c.elem->>'id') as id, (c.idx - 1) as idx
  from app_state, jsonb_array_elements(coalesce(data->'taskCategories', '[]'::jsonb)) with ordinality as c(elem, idx)
  where id = 1
) sub
where t.id = sub.id;

update checklist_template t
set sort_order = sub.idx
from (
  select (c.elem->>'id') as id, (c.idx - 1) as idx
  from app_state, jsonb_array_elements(coalesce(data->'checklistTemplate', '[]'::jsonb)) with ordinality as c(elem, idx)
  where id = 1
) sub
where t.id = sub.id;

update email_templates t
set sort_order = sub.idx
from (
  select (c.elem->>'id') as id, (c.idx - 1) as idx
  from app_state, jsonb_array_elements(coalesce(data->'emailTemplates', '[]'::jsonb)) with ordinality as c(elem, idx)
  where id = 1
) sub
where t.id = sub.id;

update contact_groups t
set sort_order = sub.idx
from (
  select (g.elem->>'id') as id, (g.idx - 1) as idx
  from app_state, jsonb_array_elements(coalesce(data->'contactGroups', '[]'::jsonb)) with ordinality as g(elem, idx)
  where id = 1
) sub
where t.id = sub.id;

update contact_rows t
set sort_order = sub.idx
from (
  select (r.elem->>'id') as id, (r.idx - 1) as idx
  from app_state,
    jsonb_array_elements(coalesce(data->'contactGroups', '[]'::jsonb)) as g,
    jsonb_array_elements(coalesce(g->'rows', '[]'::jsonb)) with ordinality as r(elem, idx)
  where id = 1
) sub
where t.id = sub.id;

-- Anything not found in the original blob (e.g. a group/category/etc.
-- added after this table went live) gets appended after everything
-- else, in whatever order it currently has.
update task_categories set sort_order = renumbered.rn from (
  select id, row_number() over (order by sort_order nulls last, created_at, id) - 1 as rn from task_categories
) renumbered where task_categories.id = renumbered.id;

update checklist_template set sort_order = renumbered.rn from (
  select id, row_number() over (order by sort_order nulls last, created_at, id) - 1 as rn from checklist_template
) renumbered where checklist_template.id = renumbered.id;

update email_templates set sort_order = renumbered.rn from (
  select id, row_number() over (order by sort_order nulls last, created_at, id) - 1 as rn from email_templates
) renumbered where email_templates.id = renumbered.id;

update contact_groups set sort_order = renumbered.rn from (
  select id, row_number() over (order by sort_order nulls last, created_at, id) - 1 as rn from contact_groups
) renumbered where contact_groups.id = renumbered.id;

update contact_rows set sort_order = renumbered.rn from (
  select id, row_number() over (order by sort_order nulls last, created_at, id) - 1 as rn from contact_rows
) renumbered where contact_rows.id = renumbered.id;

alter table task_categories alter column sort_order set not null;
alter table checklist_template alter column sort_order set not null;
alter table email_templates alter column sort_order set not null;
alter table contact_groups alter column sort_order set not null;
alter table contact_rows alter column sort_order set not null;
