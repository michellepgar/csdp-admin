-- Apply after Phase 40 to project jqsqstjmfsqqrnoxpuvn.
-- Additive: existing file/assignment identity and fields are preserved.
begin;
lock table task_files, task_file_categories in share row exclusive mode;
create temporary table phase41_original_files on commit drop as select id,to_jsonb(f)-'table_id' as original from task_files f;
create temporary table phase41_original_assignments on commit drop as select id,to_jsonb(a) as original from task_file_categories a;
alter table task_files add column if not exists table_id text;
update task_files f set table_id=(select array_to_json(array_agg(a.category_id order by a.category_id))::text
  from task_file_categories a where a.task_file_id=f.id) where f.table_id is null;
create index if not exists task_files_school_table_idx on task_files(school_id,table_id);

-- First assignment initializes new-file membership, including legacy/restore paths.
create or replace function initialize_task_table() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  update task_files set table_id=array_to_json(array[new.category_id])::text where id=new.task_file_id and table_id is null;
  return new;
end;
$$;
drop trigger if exists initialize_task_table on task_file_categories;
create trigger initialize_task_table after insert on task_file_categories for each row execute function initialize_task_table();

create or replace function add_task_file_category(p_school_id text,p_table_id text,p_file_ids text[],p_category_id text)
returns void language plpgsql security invoker set search_path=public as $$
declare next_position integer;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if coalesce(array_length(p_file_ids,1),0)=0 then raise exception 'Select at least one file'; end if;
  if not exists(select 1 from task_categories where id=p_category_id) then raise exception 'Invalid category'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
  if p_table_id is null or array_position(p_file_ids,null) is not null or exists(
    select 1 from unnest(p_file_ids) selected_id where not exists(
      select 1 from task_files f where f.id=selected_id and f.school_id=p_school_id and f.table_id=p_table_id))
    then raise exception 'File selection does not belong to this school/table'; end if;
  select coalesce(min(a.sort_order), (select coalesce(max(b.sort_order),-1)+1 from task_file_categories b
    join task_files g on g.id=b.task_file_id where g.school_id=p_school_id and g.table_id=p_table_id)) into next_position
    from task_file_categories a join task_files f on f.id=a.task_file_id
    where f.school_id=p_school_id and f.table_id=p_table_id and a.category_id=p_category_id;
  insert into task_file_categories(id,task_file_id,category_id,sort_order)
    select gen_random_uuid()::text,f.id,p_category_id,next_position from task_files f
    where f.id=any(p_file_ids) and f.school_id=p_school_id and f.table_id=p_table_id
    on conflict(task_file_id,category_id) do nothing;
end;
$$;
revoke all on function add_task_file_category(text,text,text[],text) from public;
grant execute on function add_task_file_category(text,text,text[],text) to authenticated;

-- Consistent lock order with selected-category insertion and legacy writers.
create or replace function update_task_assignment(p_school_id text,p_task_id text,p_patch jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare file_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
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
revoke all on function update_task_assignment(text,text,jsonb) from public;
grant execute on function update_task_assignment(text,text,jsonb) to authenticated;

-- Retain the existing validated atomic restore, then restore table membership.
do $$
begin
  if to_regprocedure('public.restore_school_task_backup_before_phase41(jsonb)') is null then
    alter function restore_school_task_backup(jsonb) rename to restore_school_task_backup_before_phase41;
  end if;
end;
$$;
revoke all on function restore_school_task_backup_before_phase41(jsonb) from public,authenticated;
create or replace function restore_school_task_backup(p_backup jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare school_entry record; file jsonb;
begin
  perform require_task_data_admin();
  perform restore_school_task_backup_before_phase41(p_backup);
  for school_entry in select * from jsonb_each(p_backup->'schoolData') loop
    for file in select value from jsonb_array_elements(coalesce(school_entry.value->'taskFiles','[]')) loop
      update task_files f set table_id=coalesce(nullif(file->>'tableId',''),
        (select array_to_json(array_agg(a.category_id order by a.category_id))::text from task_file_categories a where a.task_file_id=f.id))
        where f.id=file->>'id' and f.school_id=school_entry.key;
    end loop;
  end loop;
  perform ensure_task_communications_categories();
  -- Older backups predate optional communications. Current backups already
  -- contain independent assignments; do not recreate intentionally removed ones.
  if not exists(select 1 from jsonb_each(p_backup->'schoolData') schools
    cross join lateral jsonb_array_elements(coalesce(schools.value->'taskFiles','[]')) files
    where nullif(files.value->>'tableId','') is not null) then
    delete from task_communications_migrations where source_assignment_id in(select id from task_file_categories);
    perform migrate_task_communications();
  end if;
end;
$$;
revoke all on function restore_school_task_backup(jsonb) from public;
grant execute on function restore_school_task_backup(jsonb) to authenticated;

-- Optional categories: migrate only communications with recorded work.
create or replace function ensure_task_communications_categories() returns void
language plpgsql security invoker set search_path=public as $$
begin
insert into task_categories(id,name,sort_order)
select 'phase41-initial-comms','Initial Communications',coalesce(max(sort_order),-1)+1 from task_categories
on conflict do nothing;
insert into task_categories(id,name,sort_order)
select 'phase41-recheck-comms','Recheck Communications',coalesce(max(sort_order),-1)+1 from task_categories
on conflict do nothing;
insert into checklist_template(id,description,task_category_id,sort_order)
select 'phase41-checklist-'||c.id,c.name,c.id,coalesce((select max(sort_order) from checklist_template),-1)+row_number() over(order by c.sort_order)
from task_categories c where lower(btrim(c.name)) in('initial communications','recheck communications')
and not exists(select 1 from checklist_template t where t.task_category_id=c.id or lower(btrim(t.description))=lower(btrim(c.name)))
on conflict do nothing;
end;
$$;
revoke all on function ensure_task_communications_categories() from public,authenticated;

-- A marker prevents rerunning the migration from recreating intentionally removed work.
create table if not exists task_communications_migrations(source_assignment_id text primary key);
revoke all on task_communications_migrations from public,authenticated;
alter table task_communications_migrations enable row level security;
create or replace function migrate_task_communications() returns void
language plpgsql security invoker set search_path=public as $$
begin
perform ensure_task_communications_categories();
if exists(select 1 from task_file_categories a join task_categories c on c.id=a.category_id
  where lower(btrim(c.name)) in('initial','follow up','recheck')
  and (coalesce(a.comms_status,'')<>'' or cardinality(a.comms_va_assigned)>0)
  and not exists(select 1 from task_communications_migrations m where m.source_assignment_id=a.id)
  group by a.task_file_id,case when lower(btrim(c.name))='initial' then 'initial' else 'recheck' end having count(*)>1)
  then raise exception 'Ambiguous communications: multiple sources share one file/category. No data has changed.'; end if;
if exists(select 1 from task_file_categories a join task_categories c on c.id=a.category_id
  join task_file_categories target on target.task_file_id=a.task_file_id
  join task_categories target_category on target_category.id=target.category_id
  where lower(btrim(c.name)) in('initial','follow up','recheck')
  and lower(btrim(target_category.name))=case when lower(btrim(c.name))='initial' then 'initial communications' else 'recheck communications' end
  and (coalesce(a.comms_status,'')<>'' or cardinality(a.comms_va_assigned)>0)
  and not exists(select 1 from task_communications_migrations m where m.source_assignment_id=a.id)
  and (target.status is distinct from coalesce(a.comms_status,'') or target.va_assigned is distinct from a.comms_va_assigned))
  then raise exception 'Conflicting communications: existing category differs from legacy work. No data has changed.'; end if;
insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,sort_order,created_at)
select 'phase41-comms-'||a.id,a.task_file_id,target.id,coalesce(a.comms_status,''),a.comms_va_assigned,
  (select coalesce(max(b.sort_order),-1)+1 from task_file_categories b join task_files g on g.id=b.task_file_id
   where g.school_id=f.school_id and g.table_id=f.table_id),a.created_at
from task_file_categories a join task_files f on f.id=a.task_file_id join task_categories source on source.id=a.category_id
join task_categories target on lower(btrim(target.name))=case when lower(btrim(source.name))='initial' then 'initial communications' else 'recheck communications' end
where lower(btrim(source.name)) in('initial','follow up','recheck') and (coalesce(a.comms_status,'')<>'' or cardinality(a.comms_va_assigned)>0)
and not exists(select 1 from task_communications_migrations m where m.source_assignment_id=a.id)
on conflict do nothing;
insert into task_communications_migrations(source_assignment_id)
select a.id from task_file_categories a join task_categories c on c.id=a.category_id
where lower(btrim(c.name)) in('initial','follow up','recheck') and (coalesce(a.comms_status,'')<>'' or cardinality(a.comms_va_assigned)>0)
and exists(select 1 from task_file_categories copied join task_categories target on target.id=copied.category_id
  where copied.task_file_id=a.task_file_id and lower(btrim(target.name))=case when lower(btrim(c.name))='initial' then 'initial communications' else 'recheck communications' end)
on conflict do nothing;
end;
$$;
revoke all on function migrate_task_communications() from public,authenticated;
select migrate_task_communications();

-- Compatibility during cutover: only actual changes to old inline fields
-- propagate. Ordinary task edits never overwrite an independent category.
create or replace function sync_task_communications_category() returns trigger
language plpgsql security definer set search_path=public as $$
declare source_name text; target_id text; file_school text; file_table text; next_position integer;
begin
  if current_setting('csdp.restoring',true)='true' then return new; end if;
  select lower(btrim(name)) into source_name from task_categories where id=new.category_id;
  if source_name not in('initial','follow up','recheck') then return new; end if;
  if tg_op='UPDATE' and new.comms_status is not distinct from old.comms_status
    and new.comms_va_assigned is not distinct from old.comms_va_assigned then return new; end if;
  if tg_op='INSERT' and coalesce(new.comms_status,'')='' and cardinality(new.comms_va_assigned)=0 then return new; end if;
  if source_name in('follow up','recheck') and exists(select 1 from task_file_categories sibling
    join task_categories c on c.id=sibling.category_id where sibling.task_file_id=new.task_file_id and sibling.id<>new.id
    and lower(btrim(c.name)) in('follow up','recheck') and (coalesce(sibling.comms_status,'')<>'' or cardinality(sibling.comms_va_assigned)>0))
    then raise exception 'Ambiguous communications: another recheck source already has recorded work'; end if;
  select school_id,table_id into file_school,file_table from task_files where id=new.task_file_id;
  perform pg_advisory_xact_lock(hashtextextended(file_school,0));
  perform ensure_task_communications_categories();
  select id into target_id from task_categories where lower(btrim(name))=case when source_name='initial' then 'initial communications' else 'recheck communications' end;
  if not exists(select 1 from task_communications_migrations where source_assignment_id=new.id)
    and exists(select 1 from task_file_categories target where target.task_file_id=new.task_file_id and target.category_id=target_id
      and (target.status is distinct from coalesce(new.comms_status,'') or target.va_assigned is distinct from new.comms_va_assigned))
    then raise exception 'Conflicting communications: existing category already has independent work'; end if;
  select coalesce(min(a.sort_order),(select coalesce(max(b.sort_order),-1)+1 from task_file_categories b
    join task_files g on g.id=b.task_file_id where g.school_id=file_school and g.table_id=file_table)) into next_position
    from task_file_categories a join task_files f on f.id=a.task_file_id
    where f.school_id=file_school and f.table_id=file_table and a.category_id=target_id;
  insert into task_file_categories(id,task_file_id,category_id,status,va_assigned,sort_order,created_at)
    values('phase41-comms-'||new.id,new.task_file_id,target_id,coalesce(new.comms_status,''),new.comms_va_assigned,next_position,new.created_at)
    on conflict(task_file_id,category_id) do nothing;
  if tg_op='UPDATE' then
    update task_file_categories set
      status=case when new.comms_status is distinct from old.comms_status then coalesce(new.comms_status,'') else status end,
      va_assigned=case when new.comms_va_assigned is distinct from old.comms_va_assigned then new.comms_va_assigned else va_assigned end
    where task_file_id=new.task_file_id and category_id=target_id;
  end if;
  insert into task_communications_migrations values(new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function sync_task_communications_category() from public,authenticated;
drop trigger if exists sync_task_communications_category on task_file_categories;
create trigger sync_task_communications_category after insert or update of comms_status,comms_va_assigned on task_file_categories
for each row execute function sync_task_communications_category();
do $$
begin
  if exists(select 1 from phase41_original_files original left join task_files f on f.id=original.id
    where f.id is null or to_jsonb(f)-'table_id' is distinct from original.original)
    or exists(select 1 from phase41_original_assignments original left join task_file_categories a on a.id=original.id
      where a.id is null or to_jsonb(a) is distinct from original.original)
    then raise exception 'Preservation check failed: migration rolled back'; end if;
end;
$$;
commit;
