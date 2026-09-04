-- phase22_general_task_categories.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE the app code that
-- reads this table is deployed. Requires phase1_relational_team_schools.sql
-- (is_team_member()) and phase21_general_tasks.sql (general_tasks,
-- which this doesn't reference directly but ships alongside).

-- Same shape and role as task_categories (phase2_relational_tasks_checklist.sql)
-- but for General Tasks -- Michelle asked for this to be editable the
-- same way school Tasks' categories are, not a fixed list.
create table general_task_categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table general_task_categories enable row level security;

grant select, insert, update, delete on general_task_categories to authenticated;

create policy "team members can access general_task_categories"
on general_task_categories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- Seed the four categories the app shipped with before this table
-- existed, so the dropdown isn't empty on first load. Plain fixed ids
-- (not gen_random_uuid(), which isn't used elsewhere in this project's
-- migrations) -- matches every other table's own text-id convention.
insert into general_task_categories (id, name, sort_order) values
  ('gtc-admin', 'Admin', 0),
  ('gtc-training', 'Training', 1),
  ('gtc-team-meeting', 'Team Meeting', 2),
  ('gtc-payroll', 'Payroll', 3);
