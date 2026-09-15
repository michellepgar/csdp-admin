-- phase37_school_specific_categories.sql — run once in the Supabase SQL editor
-- Adds per-school task categories and their matching per-school checklist items.

alter table task_categories
  add column if not exists school_id text references schools(id) on delete cascade;
alter table checklist_template
  add column if not exists school_id text references schools(id) on delete cascade,
  add column if not exists task_category_id text references task_categories(id) on delete cascade;

drop index if exists task_categories_lower_name_unique_idx;
create unique index if not exists task_categories_global_lower_name_unique_idx
  on task_categories (lower(name)) where school_id is null;
create unique index if not exists task_categories_school_lower_name_unique_idx
  on task_categories (school_id, lower(name)) where school_id is not null;
create unique index if not exists checklist_template_task_category_unique_idx
  on checklist_template (task_category_id) where task_category_id is not null;

create or replace function create_school_task_category(p_school_id text, p_name text)
returns void language plpgsql security invoker as $$
declare
  v_name text := trim(p_name);
  v_category_id text := gen_random_uuid()::text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if v_name = '' then raise exception 'Category name is required'; end if;
  if not exists (select 1 from schools where id = p_school_id) then raise exception 'School not found'; end if;
  if exists (select 1 from task_categories where school_id = p_school_id and lower(name) = lower(v_name)) then
    raise exception 'A task category already uses that name for this school';
  end if;
  insert into task_categories (id, name, school_id, sort_order)
  values (v_category_id, v_name, p_school_id, coalesce((select max(sort_order) + 1 from task_categories where school_id = p_school_id), 0));
  insert into checklist_template (id, description, school_id, task_category_id, sort_order)
  values (gen_random_uuid()::text, v_name, p_school_id, v_category_id, coalesce((select max(sort_order) + 1 from checklist_template where school_id = p_school_id), 0));
end;
$$;

create or replace function rename_school_task_category(p_id text, p_name text)
returns void language plpgsql security invoker as $$
declare v_school_id text; v_old_name text; v_name text := trim(p_name);
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if v_name = '' then raise exception 'Category name is required'; end if;
  select school_id, name into v_school_id, v_old_name from task_categories where id = p_id for update;
  if v_school_id is null then raise exception 'School category not found'; end if;
  if exists (select 1 from task_categories where school_id = v_school_id and id <> p_id and lower(name) = lower(v_name)) then
    raise exception 'A task category already uses that name for this school';
  end if;
  update task_categories set name = v_name where id = p_id;
  update tasks set category = v_name where school_id = v_school_id and category = v_old_name;
  update checklist_template set description = v_name where task_category_id = p_id;
end;
$$;

create or replace function delete_school_task_category(p_id text)
returns void language plpgsql security invoker as $$
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if not exists (select 1 from task_categories where id = p_id and school_id is not null) then raise exception 'School category not found'; end if;
  delete from task_categories where id = p_id;
end;
$$;

grant execute on function create_school_task_category(text, text) to authenticated;
grant execute on function rename_school_task_category(text, text) to authenticated;
grant execute on function delete_school_task_category(text) to authenticated;
