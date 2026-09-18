-- Lets a task file be moved to a different category without losing its
-- status/VAs/count/comms -- previously the only way to change a file's
-- category was remove-then-re-add, which reset all of that. Apply after
-- Phase 41 (update_task_assignment). No new trigger needed --
-- check_task_assignment_filename (Phase 39) already fires on `update of
-- category_id`, so it re-validates the filename-uniqueness rule for the
-- move the same as it does for an insert.
begin;

create or replace function move_task_file_category(p_school_id text, p_task_id text, p_new_category_id text) returns void
language plpgsql security invoker set search_path=public as $$
declare file_id text;
begin
  if auth.uid() is null or not is_team_member() then raise exception 'Not authorized'; end if;
  if p_new_category_id is null or btrim(p_new_category_id)='' then raise exception 'Choose a category'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id,0));
  select f.id into file_id from task_files f join task_file_categories a on a.task_file_id=f.id
    where a.id=p_task_id and f.school_id=p_school_id for update of a;
  if file_id is null then raise exception 'Task does not belong to this school'; end if;
  if not exists (select 1 from task_categories where id=p_new_category_id) then
    raise exception 'That category no longer exists';
  end if;
  if exists (select 1 from task_file_categories where task_file_id=file_id and category_id=p_new_category_id and id<>p_task_id) then
    raise exception 'This file is already in that category'
      using errcode='23505', constraint='task_file_categories_task_file_id_category_id_key';
  end if;
  update task_file_categories set category_id=p_new_category_id where id=p_task_id and task_file_id=file_id;
end;
$$;

revoke all on function move_task_file_category(text,text,text) from public;
grant execute on function move_task_file_category(text,text,text) to authenticated;
commit;
