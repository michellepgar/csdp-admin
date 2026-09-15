alter table tasks add column if not exists sort_order integer;

with ranked as (
  select id, row_number() over (partition by school_id, category order by created_at, id) - 1 as position
  from tasks
)
update tasks set sort_order = ranked.position from ranked where tasks.id = ranked.id and tasks.sort_order is null;

alter table tasks alter column sort_order set not null;
alter table tasks alter column sort_order set default 0;
create index if not exists tasks_school_category_sort_order_idx on tasks (school_id, category, sort_order);
