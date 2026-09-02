-- phase2_backfill.sql — run once, immediately after
-- phase2_relational_tasks_checklist.sql and BEFORE deploying the app
-- code that reads from these tables. Copies the current app_state
-- blob's task categories, checklist template/progress, and every
-- school's tasks/email tracker items into the new tables.

insert into task_categories (id, name)
select c->>'id', c->>'name'
from app_state, jsonb_array_elements(coalesce(data->'taskCategories', '[]'::jsonb)) as c
where id = 1;

insert into checklist_template (id, description)
select t->>'id', t->>'description'
from app_state, jsonb_array_elements(coalesce(data->'checklistTemplate', '[]'::jsonb)) as t
where id = 1;

insert into tasks (id, school_id, category, file_name, count, status, va_assigned, created_at)
select
  task->>'id',
  sd.key,
  task->>'category',
  task->>'fileName',
  task->>'count',
  coalesce(task->>'status', ''),
  coalesce(
    (select array_agg(x) from jsonb_array_elements_text(task->'vaAssigned') as x),
    '{}'
  ),
  coalesce((task->>'createdAt')::timestamptz, now())
from app_state,
  jsonb_each(coalesce(data->'schoolData', '{}'::jsonb)) as sd,
  jsonb_array_elements(coalesce(sd.value->'tasks', '[]'::jsonb)) as task
where id = 1;

insert into email_tracker_items (id, school_id, description, status, added_by, created_at)
select
  item->>'id',
  sd.key,
  item->>'description',
  coalesce(item->>'status', ''),
  coalesce(item->>'addedBy', ''),
  coalesce((item->>'createdAt')::timestamptz, now())
from app_state,
  jsonb_each(coalesce(data->'schoolData', '{}'::jsonb)) as sd,
  jsonb_array_elements(coalesce(sd.value->'emailTracker', '[]'::jsonb)) as item
where id = 1;

insert into checklist_progress (school_id, template_item_id, status)
select
  split_part(kv.key, ':', 1),
  split_part(kv.key, ':', 2),
  kv.value->>'status'
from app_state, jsonb_each(coalesce(data->'checklistProgress', '{}'::jsonb)) as kv
where id = 1;
