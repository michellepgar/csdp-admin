-- File names are display labels, not identities. Apply after Phase 39.
-- Each add always creates a new file ID, even when name/category match.
-- This migration does not change existing files or assignment data.
begin;
drop trigger if exists check_task_assignment_filename on task_file_categories;
drop trigger if exists check_task_file_filename on task_files;
drop function if exists check_task_assignment_filename();
drop function if exists check_task_file_filename();
drop index if exists task_files_school_file_name_unique_idx;

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
  select coalesce(max(sort_order),-1)+1 into next_position from task_files where school_id=p_school_id;
  insert into task_files(id,school_id,file_name,sort_order) values(p_id,p_school_id,btrim(p_file_name),next_position);
  for selected_category_id in select distinct value from unnest(p_category_ids) value loop
    insert into task_file_categories(id,task_file_id,category_id,sort_order)
      values(gen_random_uuid()::text,p_id,selected_category_id,0);
  end loop;
end;
$$;
revoke all on function add_task_file(text,text,text,text[]) from public;
grant execute on function add_task_file(text,text,text,text[]) to authenticated;
commit;
