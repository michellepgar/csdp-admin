-- phase38_shared_file_multi_category.sql — run once in the Supabase SQL editor
-- for project jqsqstjmfsqqrnoxpuvn. Keeps the legacy tasks table intact
-- as a rollback source while the app moves to shared file rows.

begin;

alter table checklist_progress
  add column if not exists not_needed boolean not null default false;

-- Make every existing category available to every school. When a scoped
-- category duplicates a global name, preserve its task/checklist data and
-- merge the scoped row into the existing global row.
do $$
declare
  scoped record;
  global_id text;
  scoped_item_id text;
  global_item_id text;
begin
  for scoped in
    select id, school_id, name from task_categories
    where school_id is not null order by created_at, id
  loop
    select id into global_id
    from task_categories
    where school_id is null and lower(btrim(name)) = lower(btrim(scoped.name))
    limit 1;

    if global_id is null then
      update task_categories set school_id = null where id = scoped.id;
      update checklist_template set school_id = null where task_category_id = scoped.id;
    else
      select id into scoped_item_id from checklist_template where task_category_id = scoped.id limit 1;
      select id into global_item_id from checklist_template where task_category_id = global_id limit 1;

      if scoped_item_id is not null and global_item_id is not null then
        insert into checklist_progress (school_id, template_item_id, status, checked_by, not_needed)
        select school_id, global_item_id, status, checked_by, not_needed
        from checklist_progress where template_item_id = scoped_item_id
        on conflict (school_id, template_item_id) do update set
          status = case when excluded.status = 'Done' then 'Done' else checklist_progress.status end,
          checked_by = coalesce(excluded.checked_by, checklist_progress.checked_by),
          not_needed = checklist_progress.not_needed or excluded.not_needed;
        delete from checklist_template where id = scoped_item_id;
      elsif scoped_item_id is not null then
        update checklist_template
        set task_category_id = global_id, school_id = null, description = scoped.name
        where id = scoped_item_id;
      end if;

      update tasks set category = scoped.name
      where school_id = scoped.school_id and lower(btrim(category)) = lower(btrim(scoped.name));
      delete from task_categories where id = scoped.id;
    end if;

    global_id := null;
    scoped_item_id := null;
    global_item_id := null;
  end loop;
end;
$$;

drop index if exists task_categories_school_lower_name_unique_idx;
drop index if exists task_categories_global_lower_name_unique_idx;
create unique index if not exists task_categories_lower_name_unique_idx
  on task_categories (lower(btrim(name)));

-- Preserve legacy categories even if their editor entry was previously removed.
insert into task_categories (id, name, sort_order)
select gen_random_uuid()::text, source.category,
       coalesce((select max(sort_order) from task_categories), -1)
       + row_number() over (order by lower(source.category))
from (
  select min(btrim(category)) as category
  from tasks
  where btrim(category) <> ''
  group by lower(btrim(category))
) source
where not exists (
  select 1 from task_categories c
  where lower(btrim(c.name)) = lower(source.category)
);

create table if not exists task_files (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  file_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists task_files_school_file_name_unique_idx
  on task_files (school_id, lower(btrim(file_name)));
create index if not exists task_files_school_sort_order_idx
  on task_files (school_id, sort_order);

create table if not exists task_file_categories (
  id text primary key,
  task_file_id text not null references task_files(id) on delete cascade,
  category_id text not null references task_categories(id),
  status text not null default '',
  va_assigned text[] not null default '{}',
  count text,
  comms_status text,
  comms_va_assigned text[] not null default '{}',
  sort_order integer not null default 0,
  unique (task_file_id, category_id)
);

alter table task_files enable row level security;
alter table task_file_categories enable row level security;
grant select, insert, update, delete on task_files to authenticated;
grant select, insert, update, delete on task_file_categories to authenticated;

drop policy if exists "team members can access task_files" on task_files;
create policy "team members can access task_files" on task_files for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

drop policy if exists "team members can access task_file_categories" on task_file_categories;
create policy "team members can access task_file_categories" on task_file_categories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

insert into task_files (id, school_id, file_name, sort_order, created_at)
select gen_random_uuid()::text, school_id, min(file_name), min(sort_order), min(created_at)
from tasks
group by school_id, lower(btrim(file_name))
on conflict (school_id, lower(btrim(file_name))) do nothing;

insert into task_file_categories
  (id, task_file_id, category_id, status, va_assigned, count,
   comms_status, comms_va_assigned, sort_order)
select distinct on (f.id, c.id)
  t.id, f.id, c.id, t.status, t.va_assigned, t.count,
  t.comms_status, coalesce(t.comms_va_assigned, '{}'), t.sort_order
from tasks t
join task_files f
  on f.school_id = t.school_id
 and lower(btrim(f.file_name)) = lower(btrim(t.file_name))
join task_categories c on lower(btrim(c.name)) = lower(btrim(t.category))
order by f.id, c.id, t.created_at, t.id
on conflict do nothing;

create or replace function add_task_file(
  p_id text,
  p_school_id text,
  p_file_name text,
  p_category_ids text[]
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  next_position integer;
  category_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if btrim(p_file_name) = '' then raise exception 'File name is required'; end if;
  if coalesce(array_length(p_category_ids, 1), 0) = 0 then raise exception 'Choose at least one category'; end if;
  if exists (select 1 from task_files where school_id = p_school_id and lower(btrim(file_name)) = lower(btrim(p_file_name))) then
    raise exception 'That file name already exists for this school';
  end if;
  if (select count(*) from task_categories where id = any(p_category_ids)) <> (select count(distinct value) from unnest(p_category_ids) value) then
    raise exception 'One or more categories are invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id, 0));
  select coalesce(max(sort_order), -1) + 1 into next_position
  from task_files where school_id = p_school_id;
  insert into task_files (id, school_id, file_name, sort_order)
  values (p_id, p_school_id, btrim(p_file_name), next_position);

  foreach category_id in array p_category_ids loop
    insert into task_file_categories (id, task_file_id, category_id, sort_order)
    values (gen_random_uuid()::text, p_id, category_id, 0)
    on conflict (task_file_id, category_id) do nothing;
  end loop;
end;
$$;

create or replace function reorder_task_files(p_school_id text, p_ordered_ids text[])
returns void language plpgsql security invoker set search_path = public as $$
declare item_id text; position integer := 0;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if (select count(*) from task_files where school_id = p_school_id) <> coalesce(array_length(p_ordered_ids, 1), 0)
     or exists (select 1 from unnest(p_ordered_ids) id where not exists (select 1 from task_files f where f.id = id and f.school_id = p_school_id)) then
    raise exception 'Submitted order does not match this school';
  end if;
  foreach item_id in array p_ordered_ids loop
    update task_files set sort_order = position where id = item_id and school_id = p_school_id;
    position := position + 1;
  end loop;
end;
$$;

grant execute on function add_task_file(text, text, text, text[]) to authenticated;
grant execute on function reorder_task_files(text, text[]) to authenticated;

commit;
