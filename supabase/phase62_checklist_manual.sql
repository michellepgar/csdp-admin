-- phase62_checklist_manual.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn.
--
-- The Yearly Checklist is now changed ONLY from its "Edit template" panel
-- (add, edit, remove). Before this, saving communications work on a task
-- quietly recreated the "Initial Communications" and "Recheck
-- Communications" categories AND put them back on the checklist, even after
-- someone had removed them.
--
-- This keeps the two categories available for that background sync (Tasks
-- still needs them) but no longer adds anything to the checklist.

create or replace function ensure_task_communications_categories() returns void
language plpgsql security invoker set search_path=public as $$
begin
  insert into task_categories(id,name,sort_order)
  select 'phase41-initial-comms','Initial Communications',coalesce(max(sort_order),-1)+1 from task_categories
  on conflict do nothing;
  insert into task_categories(id,name,sort_order)
  select 'phase41-recheck-comms','Recheck Communications',coalesce(max(sort_order),-1)+1 from task_categories
  on conflict do nothing;
end;
$$;
