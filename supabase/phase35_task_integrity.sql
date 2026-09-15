-- phase35_task_integrity.sql — run once in Supabase SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, after phase34_task_sort_order.sql and
-- before deploying the task-ordering UI.

create unique index if not exists task_categories_lower_name_unique_idx
on task_categories (lower(name));

create or replace function add_task_at_end(
  p_id text,
  p_school_id text,
  p_category text,
  p_file_name text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_position integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || E'\\x1f' || p_category, 0));
  select coalesce(max(sort_order), -1) + 1
    into next_position
    from tasks
   where school_id = p_school_id and category = p_category;

  insert into tasks (id, school_id, category, file_name, sort_order, status, va_assigned)
  values (p_id, p_school_id, p_category, p_file_name, next_position, '', '{}');
end;
$$;

create or replace function rename_task_category(p_id text, p_name text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_name text;
begin
  select name into old_name from task_categories where id = p_id for update;
  if old_name is null then raise exception 'Task category not found'; end if;

  update task_categories set name = p_name where id = p_id;
  update tasks set category = p_name where category = old_name;
end;
$$;

grant execute on function add_task_at_end(text, text, text, text) to authenticated;
grant execute on function rename_task_category(text, text) to authenticated;
