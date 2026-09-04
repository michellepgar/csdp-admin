-- phase21_general_tasks.sql — run once in Supabase's SQL Editor for
-- project jqsqstjmfsqqrnoxpuvn, BEFORE the app code that reads this
-- table is deployed. Requires Phase 1
-- (supabase/phase1_relational_team_schools.sql) to already be applied
-- — this reuses its is_team_member() function.

-- Work that isn't tied to any school (admin, training, team meetings,
-- etc.) -- no school_id, unlike tasks (phase2_relational_tasks_checklist.sql),
-- which this otherwise mirrors. category is a plain value from a fixed
-- list the app enforces (GENERAL_TASK_CATEGORIES in lib/app-state.ts),
-- not a foreign key -- there's no separate manageable category table
-- for this the way task_categories is for school Tasks.
create table general_tasks (
  id text primary key,
  category text not null,
  description text not null,
  status text not null,
  va_assigned text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table general_tasks enable row level security;

grant select, insert, update, delete on general_tasks to authenticated;

create policy "team members can access general_tasks"
on general_tasks for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
