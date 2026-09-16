-- phase43_daily_plan.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn.
--
-- 1) Adds status_changed_at to task_file_categories and general_tasks,
--    trigger-maintained, so the new Overview "Today" section can tell
--    "completed today" apart from "completed at some point in the past".
-- 2) Adds "Review" as a real status value used by the app (no column
--    change needed -- status is already free text).
-- 3) Creates plan_items for the new "Plans for Tomorrow" feature.

alter table task_file_categories add column if not exists status_changed_at timestamptz not null default now();
alter table general_tasks add column if not exists status_changed_at timestamptz not null default now();

create or replace function set_status_changed_at()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists task_file_categories_status_changed_at on task_file_categories;
create trigger task_file_categories_status_changed_at
before update on task_file_categories
for each row execute function set_status_changed_at();

drop trigger if exists general_tasks_status_changed_at on general_tasks;
create trigger general_tasks_status_changed_at
before update on general_tasks
for each row execute function set_status_changed_at();

create table if not exists plan_items (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('task', 'priority')),
  va_name text,
  school_id text references schools(id) on delete cascade,
  task_file_category_id text references task_file_categories(id) on delete cascade,
  general_task_id text references general_tasks(id) on delete cascade,
  label text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table plan_items enable row level security;

drop policy if exists "team members can access plan_items" on plan_items;
create policy "team members can access plan_items"
on plan_items for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
