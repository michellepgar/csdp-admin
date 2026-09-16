-- Allow independent same-named files across categories, not duplicate assignments.
-- Apply after Phase 38. Existing files, assignments, VA/status and dates are unchanged.
begin;

drop index if exists task_files_school_file_name_unique_idx;
create index if not exists task_files_school_file_name_idx
  on task_files(school_id, lower(btrim(file_name)));

-- The category belongs to a child row, so enforce the school/name/category rule
-- on both sides of the relationship. All writers take the same school lock.
create or replace function check_task_assignment_filename() returns trigger
language plpgsql security invoker set search_path=public as $$
declare parent task_files%rowtype;
begin
  -- FOR SHARE (not KEY SHARE) also blocks filename/school changes while this
  -- child waits for the school lock, so the captured identity cannot go stale.
  select * into parent from task_files where id=new.task_file_id for share;
  if not found then return new; end if; -- The FK reports a missing parent.
  perform pg_advisory_xact_lock(hashtextextended(parent.school_id,0));
  if exists (
    select 1 from task_file_categories a join task_files f on f.id=a.task_file_id
    where f.school_id=parent.school_id and lower(btrim(f.file_name))=lower(btrim(parent.file_name))
      and a.category_id=new.category_id and a.id<>new.id
  ) then
    raise exception 'That file name already exists in a selected category'
      using errcode='23505', constraint='task_file_category_name_unique';
  end if;
  return new;
end;
$$;

create or replace function check_task_file_filename() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if btrim(new.file_name)='' then raise exception 'File name is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.school_id,0));
  if exists (
    select 1 from task_file_categories own_assignment
      join task_file_categories other_assignment on other_assignment.category_id=own_assignment.category_id
      join task_files other_file on other_file.id=other_assignment.task_file_id
    where own_assignment.task_file_id=new.id and other_file.id<>new.id
      and other_file.school_id=new.school_id and lower(btrim(other_file.file_name))=lower(btrim(new.file_name))
  ) then
    raise exception 'That file name already exists in a selected category'
      using errcode='23505', constraint='task_file_category_name_unique';
  end if;
  return new;
end;
$$;

drop trigger if exists check_task_assignment_filename on task_file_categories;
create trigger check_task_assignment_filename before insert or update of task_file_id,category_id on task_file_categories
  for each row execute function check_task_assignment_filename();
drop trigger if exists check_task_file_filename on task_files;
create trigger check_task_file_filename before insert or update of file_name,school_id on task_files
  for each row execute function check_task_file_filename();

create or replace function add_task_file(p_id text,p_school_id text,p_file_name text,p_category_ids text[])
returns void language plpgsql security invoker set search_path=public as $$
declare next_position integer; selected_category_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if p_file_name is null or btrim(p_file_name)='' then raise exception 'File name is required'; end if;
  if coalesce(array_length(p_category_ids,1),0)=0 then raise exception 'Choose at least one category'; end if;
  if array_position(p_category_ids,null) is not null
    or (select count(*) from task_categories where id=any(p_category_ids)) <> (select count(distinct value) from unnest(p_category_ids) value)
    then raise exception 'One or more categories are invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
  if exists (
    select 1 from task_files f join task_file_categories a on a.task_file_id=f.id
    where f.school_id=p_school_id and lower(btrim(f.file_name))=lower(btrim(p_file_name))
      and a.category_id=any(p_category_ids)
  ) then
    raise exception 'That file name already exists in a selected category'
      using errcode='23505', constraint='task_file_category_name_unique';
  end if;
  select coalesce(max(sort_order),-1)+1 into next_position from task_files where school_id=p_school_id;
  insert into task_files(id,school_id,file_name,sort_order) values(p_id,p_school_id,btrim(p_file_name),next_position);
  for selected_category_id in select distinct value from unnest(p_category_ids) value loop
    insert into task_file_categories(id,task_file_id,category_id,sort_order)
      values(gen_random_uuid()::text,p_id,selected_category_id,0);
  end loop;
end;
$$;

-- Legacy writes identify existing assignments by ID, never merge files by name.
create or replace function sync_legacy_task_to_file() returns trigger
language plpgsql security invoker set search_path=public as $$
declare file_id text; cat_id text; previous_file_id text;
begin
  if current_setting('csdp.restoring',true)='true' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op<>'INSERT' then
    select task_file_id into previous_file_id from task_file_categories where id=old.id;
  end if;
  if tg_op='DELETE' then
    delete from task_file_categories where id=old.id;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.school_id,0));
    select id into cat_id from task_categories where lower(btrim(name))=lower(btrim(new.category));
    if cat_id is null then
      insert into task_categories(id,name) values(gen_random_uuid()::text,btrim(new.category)) returning id into cat_id;
    end if;
    if tg_op='UPDATE' and new.file_name is not distinct from old.file_name
      and new.school_id is not distinct from old.school_id and previous_file_id is not null then
      file_id:=previous_file_id;
    else
      insert into task_files(id,school_id,file_name,sort_order,created_at)
        values(gen_random_uuid()::text,new.school_id,new.file_name,new.sort_order,new.created_at) returning id into file_id;
    end if;
    insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,count,comms_status,comms_va_assigned,sort_order,created_at)
      values(new.id,file_id,cat_id,new.status,new.va_assigned,new.count,new.comms_status,coalesce(new.comms_va_assigned,'{}'),new.sort_order,new.created_at)
      on conflict(id) do update set task_file_id=excluded.task_file_id,category_id=excluded.category_id,
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

-- Restore keeps explicit shared files. Older backups without file IDs restore
-- each task independently; a matching display name is not proof of sharing.
create or replace function restore_school_task_backup(p_backup jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare school_entry record; file jsonb; assignment jsonb; task jsonb; file_id text; cat_id text; progress record;
  category_map jsonb:='{}'; template_map jsonb:='{}'; categories jsonb:='[]'; templates jsonb:='[]';
  entry jsonb; target_id text; linked_id text;
begin
  perform require_task_data_admin();
  if jsonb_array_length(p_backup->'vas')=0 or jsonb_array_length(p_backup->'schools')=0
    or jsonb_array_length(p_backup->'taskCategories')=0 then raise exception 'Invalid backup'; end if;
  for entry in select value from jsonb_array_elements(p_backup->'taskCategories') order by (value->>'schoolId') is not null loop
    select c->>'id' into target_id from jsonb_array_elements(categories) c where lower(btrim(c->>'name'))=lower(btrim(entry->>'name')) limit 1;
    if target_id is null then target_id:=entry->>'id'; categories:=categories||jsonb_build_array(entry-'schoolId'); end if;
    category_map:=category_map||jsonb_build_object(entry->>'id',target_id);
  end loop;
  for entry in select value from jsonb_array_elements(p_backup->'checklistTemplate') order by (value->>'schoolId') is not null loop
    linked_id:=category_map->>(entry->>'taskCategoryId'); target_id:=null;
    if linked_id is not null then
      select c->>'id' into target_id from jsonb_array_elements(templates) c where c->>'taskCategoryId'=linked_id limit 1;
      entry:=jsonb_set(entry,'{taskCategoryId}',to_jsonb(linked_id));
    end if;
    if target_id is null then target_id:=entry->>'id'; templates:=templates||jsonb_build_array(entry-'schoolId'); end if;
    template_map:=template_map||jsonb_build_object(entry->>'id',target_id);
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
    select c->>'id',c->>'description',c->>'taskCategoryId',position::integer-1 from jsonb_array_elements(templates) with ordinality entries(c,position);
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
        if cat_id is null then insert into task_categories(id,name) values(gen_random_uuid()::text,task->>'category') returning id into cat_id; end if;
        insert into task_files(id,school_id,file_name,sort_order,created_at)
          values(gen_random_uuid()::text,school_entry.key,task->>'fileName',coalesce((task->>'sortOrder')::integer,0),coalesce((task->>'createdAt')::timestamptz,now())) returning id into file_id;
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
        checked_by=coalesce(excluded.checked_by,checklist_progress.checked_by),not_needed=excluded.not_needed or checklist_progress.not_needed;
  end loop;
  perform set_config('csdp.restoring','false',true);
end;
$$;

revoke all on function add_task_file(text,text,text,text[]) from public;
grant execute on function add_task_file(text,text,text,text[]) to authenticated;
revoke all on function restore_school_task_backup(jsonb) from public;
grant execute on function restore_school_task_backup(jsonb) to authenticated;
commit;
