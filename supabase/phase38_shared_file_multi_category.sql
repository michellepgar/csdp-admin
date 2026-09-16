-- phase38_shared_file_multi_category.sql — run once in the Supabase SQL editor
-- for project jqsqstjmfsqqrnoxpuvn. Keeps the legacy tasks table intact
-- as a rollback source while the app moves to shared file rows.

begin;

-- Hold legacy writers until the backfill and compatibility setup commit.
lock table tasks in share row exclusive mode;
select set_config('csdp.phase38_backfill', (to_regclass('public.task_file_categories') is null)::text, true);
do $$
declare duplicates text;
begin
  if exists(select 1 from tasks where btrim(category)='') then
    raise exception 'Blank legacy categories exist. Assign a category before migrating; no data has been changed.';
  end if;
  select string_agg(ids, '; ') into duplicates from (
    select string_agg(id, ', ' order by id) as ids
    from tasks
    group by school_id, lower(btrim(file_name)), lower(btrim(category))
    having count(*) > 1
    limit 10
  ) conflicts;
  if duplicates is not null then
    raise exception 'Ambiguous legacy tasks: %', duplicates
      using hint = 'Resolve duplicate school/file/category rows before migrating. No data has been changed.';
  end if;
end;
$$;

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
drop index if exists task_categories_lower_name_unique_idx;
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
  created_at timestamptz not null default now(),
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
where current_setting('csdp.phase38_backfill') = 'true'
group by school_id, lower(btrim(file_name))
on conflict (school_id, lower(btrim(file_name))) do nothing;

insert into task_file_categories
  (id, task_file_id, category_id, status, va_assigned, count,
   comms_status, comms_va_assigned, sort_order, created_at)
select
  t.id, f.id, c.id, t.status, t.va_assigned, t.count,
  t.comms_status, coalesce(t.comms_va_assigned, '{}'), t.sort_order, t.created_at
from tasks t
join task_files f
  on f.school_id = t.school_id
 and lower(btrim(f.file_name)) = lower(btrim(t.file_name))
join task_categories c on lower(btrim(c.name)) = lower(btrim(t.category))
where current_setting('csdp.phase38_backfill') = 'true'
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
     or (select count(distinct id) from unnest(p_ordered_ids) id) <> coalesce(array_length(p_ordered_ids, 1), 0)
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

-- Keep writes from the previously deployed app visible during cutover.
create or replace function sync_legacy_task_to_file() returns trigger
language plpgsql security invoker set search_path = public as $$
declare file_id text; cat_id text; previous_file_id text;
begin
  if current_setting('csdp.restoring', true) = 'true' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op <> 'INSERT' then
    select task_file_id into previous_file_id from task_file_categories where id = old.id;
  end if;
  if tg_op = 'DELETE' then
    delete from task_file_categories where id = old.id;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.school_id, 0));
    select id into cat_id from task_categories where lower(btrim(name)) = lower(btrim(new.category));
    if cat_id is null then
      insert into task_categories(id,name) values (gen_random_uuid()::text,btrim(new.category)) returning id into cat_id;
    end if;
    if tg_op='UPDATE' and new.file_name is not distinct from old.file_name
      and new.school_id is not distinct from old.school_id and previous_file_id is not null then
      file_id := previous_file_id;
    else
      insert into task_files(id,school_id,file_name,sort_order,created_at)
        values(gen_random_uuid()::text,new.school_id,new.file_name,new.sort_order,new.created_at)
        on conflict (school_id,lower(btrim(file_name))) do nothing;
      select id into file_id from task_files where school_id=new.school_id and lower(btrim(file_name))=lower(btrim(new.file_name));
    end if;
    insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,count,comms_status,comms_va_assigned,sort_order,created_at)
      values(new.id,file_id,cat_id,new.status,new.va_assigned,new.count,new.comms_status,coalesce(new.comms_va_assigned,'{}'),new.sort_order,new.created_at)
      on conflict (id) do update set task_file_id=excluded.task_file_id,category_id=excluded.category_id,
        status=case when new.status is distinct from old.status then excluded.status else task_file_categories.status end,
        va_assigned=case when new.va_assigned is distinct from old.va_assigned then excluded.va_assigned else task_file_categories.va_assigned end,
        count=case when new.count is distinct from old.count then excluded.count else task_file_categories.count end,
        comms_status=case when new.comms_status is distinct from old.comms_status then excluded.comms_status else task_file_categories.comms_status end,
        comms_va_assigned=case when new.comms_va_assigned is distinct from old.comms_va_assigned then excluded.comms_va_assigned else task_file_categories.comms_va_assigned end,
        sort_order=case when new.sort_order is distinct from old.sort_order then excluded.sort_order else task_file_categories.sort_order end;
  end if;
  if previous_file_id is not null then
    delete from task_files where id=previous_file_id and not exists(select 1 from task_file_categories where task_file_id=previous_file_id);
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists sync_legacy_task_to_file on tasks;
create trigger sync_legacy_task_to_file after insert or update or delete on tasks
  for each row execute function sync_legacy_task_to_file();

create or replace function remove_task_assignment(p_school_id text,p_task_id text) returns void
language plpgsql security invoker set search_path=public as $$
declare file_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
  select f.id into file_id from task_files f join task_file_categories a on a.task_file_id=f.id
    where a.id=p_task_id and f.school_id=p_school_id for update of f;
  if file_id is null then raise exception 'Task does not belong to this school'; end if;
  delete from tasks where id=p_task_id and school_id=p_school_id;
  delete from task_file_categories where id=p_task_id and task_file_id=file_id;
  delete from task_files where id=file_id and not exists(select 1 from task_file_categories where task_file_id=file_id);
end;
$$;

create or replace function remove_task_file(p_school_id text,p_file_id text) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
  perform 1 from task_files where id=p_file_id and school_id=p_school_id for update;
  if not found then raise exception 'File does not belong to this school'; end if;
  delete from tasks where school_id=p_school_id and id in(select id from task_file_categories where task_file_id=p_file_id);
  delete from task_files where id=p_file_id and school_id=p_school_id;
end;
$$;

create or replace function update_task_assignment(p_school_id text,p_task_id text,p_patch jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare file_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  select f.id into file_id from task_files f join task_file_categories a on a.task_file_id=f.id
    where a.id=p_task_id and f.school_id=p_school_id for update of a;
  if file_id is null then raise exception 'Task does not belong to this school'; end if;
  update task_file_categories set
    status=case when p_patch ? 'status' then p_patch->>'status' else status end,
    count=case when p_patch ? 'count' then p_patch->>'count' else count end,
    comms_status=case when p_patch ? 'comms_status' then p_patch->>'comms_status' else comms_status end,
    va_assigned=case when p_patch ? 'va_assigned' then array(select jsonb_array_elements_text(p_patch->'va_assigned')) else va_assigned end,
    comms_va_assigned=case when p_patch ? 'comms_va_assigned' then array(select jsonb_array_elements_text(p_patch->'comms_va_assigned')) else comms_va_assigned end
    where id=p_task_id and task_file_id=file_id;
end;
$$;

create or replace function require_task_data_admin() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from vas where lower(email)=lower(coalesce(auth.jwt()->>'email',''))
    and (name='Michelle' or admin is true or role='owner')) then raise exception 'Not authorized'; end if;
end;
$$;
revoke all on function require_task_data_admin() from public;
grant execute on function require_task_data_admin() to authenticated;

create or replace function reset_school_task_data() returns void
language plpgsql security invoker set search_path=public as $$
begin
  perform require_task_data_admin();
  delete from tasks where true;
  delete from task_files where true;
  delete from checklist_progress where true;
end;
$$;

-- The dependent school/task part of restore must be a single transaction.
-- A malformed backup raises before commit, leaving the original data intact.
create or replace function restore_school_task_backup(p_backup jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare school_entry record; file jsonb; assignment jsonb; task jsonb; file_id text; cat_id text; progress record;
  category_map jsonb := '{}'; template_map jsonb := '{}'; categories jsonb := '[]'; templates jsonb := '[]';
  entry jsonb; target_id text; linked_id text;
begin
  perform require_task_data_admin();
  if jsonb_array_length(p_backup->'vas')=0 or jsonb_array_length(p_backup->'schools')=0
    or jsonb_array_length(p_backup->'taskCategories')=0 then raise exception 'Invalid backup'; end if;
  -- Older backups may contain a global category and school-only copies.
  -- Prefer the global ID, map assignments and linked checklist items to it.
  for entry in select value from jsonb_array_elements(p_backup->'taskCategories')
    order by (value->>'schoolId') is not null loop
    select c->>'id' into target_id from jsonb_array_elements(categories) c
      where lower(btrim(c->>'name'))=lower(btrim(entry->>'name')) limit 1;
    if target_id is null then
      target_id := entry->>'id'; categories := categories || jsonb_build_array(entry-'schoolId');
    end if;
    category_map := category_map || jsonb_build_object(entry->>'id',target_id);
  end loop;
  for entry in select value from jsonb_array_elements(p_backup->'checklistTemplate')
    order by (value->>'schoolId') is not null loop
    linked_id := category_map->>(entry->>'taskCategoryId'); target_id := null;
    if linked_id is not null then
      select c->>'id' into target_id from jsonb_array_elements(templates) c where c->>'taskCategoryId'=linked_id limit 1;
      entry := jsonb_set(entry,'{taskCategoryId}',to_jsonb(linked_id));
    end if;
    if target_id is null then
      target_id := entry->>'id'; templates := templates || jsonb_build_array(entry-'schoolId');
    end if;
    template_map := template_map || jsonb_build_object(entry->>'id',target_id);
  end loop;
  perform set_config('csdp.restoring','true',true);
  delete from task_files where true;
  delete from tasks where true;
  delete from checklist_template where true;
  delete from task_categories where true;
  perform restore_vas_and_schools(p_backup->'vas',p_backup->'schools');
  insert into task_categories(id,name,sort_order)
    select c->>'id',c->>'name',position::integer-1 from jsonb_array_elements(categories) with ordinality entries(c,position);
  insert into checklist_template(id,description,task_category_id,sort_order)
    select c->>'id',c->>'description',c->>'taskCategoryId',position::integer-1
    from jsonb_array_elements(templates) with ordinality entries(c,position);
  for school_entry in select * from jsonb_each(p_backup->'schoolData') loop
    if school_entry.value ? 'taskFiles' then
      for file in select * from jsonb_array_elements(school_entry.value->'taskFiles') loop
        insert into task_files(id,school_id,file_name,sort_order,created_at)
          values(file->>'id',school_entry.key,file->>'fileName',coalesce((file->>'sortOrder')::integer,0),coalesce((file->>'createdAt')::timestamptz,now()));
        for assignment in select * from jsonb_array_elements(file->'categories') loop
          insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,count,comms_status,comms_va_assigned,sort_order,created_at)
            values(assignment->>'id',file->>'id',coalesce(category_map->>(assignment->>'categoryId'),assignment->>'categoryId'),assignment->>'status',
              array(select jsonb_array_elements_text(assignment->'vaAssigned')),assignment->>'count',assignment->>'commsStatus',
              array(select jsonb_array_elements_text(assignment->'commsVaAssigned')),coalesce((assignment->>'sortOrder')::integer,0),
              coalesce((assignment->>'createdAt')::timestamptz,(file->>'createdAt')::timestamptz,now()));
        end loop;
      end loop;
    else
      for task in select * from jsonb_array_elements(coalesce(school_entry.value->'tasks','[]')) loop
        select id into cat_id from task_categories where lower(btrim(name))=lower(btrim(task->>'category'));
        if cat_id is null then
          insert into task_categories(id,name) values(gen_random_uuid()::text,task->>'category') returning id into cat_id;
        end if;
        insert into task_files(id,school_id,file_name,sort_order,created_at)
          values(gen_random_uuid()::text,school_entry.key,task->>'fileName',coalesce((task->>'sortOrder')::integer,0),coalesce((task->>'createdAt')::timestamptz,now()))
          on conflict(school_id,lower(btrim(file_name))) do nothing;
        select id into file_id from task_files where school_id=school_entry.key and lower(btrim(file_name))=lower(btrim(task->>'fileName'));
        insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,count,comms_status,comms_va_assigned,sort_order,created_at)
          values(task->>'id',file_id,cat_id,task->>'status',array(select jsonb_array_elements_text(task->'vaAssigned')),task->>'count',task->>'commsStatus',
            array(select jsonb_array_elements_text(task->'commsVaAssigned')),coalesce((task->>'sortOrder')::integer,0),coalesce((task->>'createdAt')::timestamptz,now()));
      end loop;
    end if;
  end loop;
  for progress in select * from jsonb_each(p_backup->'checklistProgress') loop
    insert into checklist_progress(school_id,template_item_id,status,checked_by,not_needed)
      values(split_part(progress.key,':',1),coalesce(template_map->>split_part(progress.key,':',2),split_part(progress.key,':',2)),progress.value->>'status',progress.value->>'checkedBy',coalesce((progress.value->>'notNeeded')::boolean,false))
      on conflict(school_id,template_item_id) do update set
        status=case when excluded.status='Done' then 'Done' else checklist_progress.status end,
        checked_by=coalesce(excluded.checked_by,checklist_progress.checked_by),
        not_needed=excluded.not_needed or checklist_progress.not_needed;
  end loop;
  perform set_config('csdp.restoring','false',true);
end;
$$;

-- Retire the old school-only API as well as its UI.
drop function if exists create_school_task_category(text,text);
drop function if exists rename_school_task_category(text,text);
drop function if exists delete_school_task_category(text);
alter table task_categories drop constraint if exists task_categories_global_only;
alter table task_categories add constraint task_categories_global_only check (school_id is null);

revoke all on function restore_school_task_backup(jsonb) from public;
revoke all on function reset_school_task_data() from public;
revoke all on function remove_task_assignment(text,text) from public;
revoke all on function update_task_assignment(text,text,jsonb) from public;
revoke all on function remove_task_file(text,text) from public;
grant execute on function restore_school_task_backup(jsonb) to authenticated;
grant execute on function reset_school_task_data() to authenticated;
grant execute on function remove_task_assignment(text,text) to authenticated;
grant execute on function update_task_assignment(text,text,jsonb) to authenticated;
grant execute on function remove_task_file(text,text) to authenticated;

commit;
