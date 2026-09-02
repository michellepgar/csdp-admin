-- phase2_relational_tasks_checklist.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying
-- backfill script and BEFORE the app code that reads these tables is
-- deployed. Requires Phase 1 (supabase/phase1_relational_team_schools.sql)
-- to already be applied — this reuses its is_team_member() function and
-- references the schools table it created.

create table task_categories (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table checklist_template (
  id text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

-- category is a plain copy of the category's name at the time the task
-- was added, not a reference to task_categories.id — a task keeps
-- showing its category even after that category is later removed
-- (matches the existing app-level comment: "Existing files keep their
-- category name even if it's later removed here").
create table tasks (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  category text not null,
  file_name text not null,
  count text,
  status text not null,
  va_assigned text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table email_tracker_items (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  description text not null,
  status text not null,
  added_by text not null,
  created_at timestamptz not null default now()
);

-- No id column: (school_id, template_item_id) is the natural key,
-- matching how the blob already keys this ("${schoolId}:${itemId}").
create table checklist_progress (
  school_id text not null references schools(id) on delete cascade,
  template_item_id text not null references checklist_template(id) on delete cascade,
  status text not null,
  primary key (school_id, template_item_id)
);

alter table task_categories enable row level security;
alter table checklist_template enable row level security;
alter table tasks enable row level security;
alter table email_tracker_items enable row level security;
alter table checklist_progress enable row level security;

grant select, insert, update, delete on task_categories to authenticated;
grant select, insert, update, delete on checklist_template to authenticated;
grant select, insert, update, delete on tasks to authenticated;
grant select, insert, update, delete on email_tracker_items to authenticated;
grant select, insert, update, delete on checklist_progress to authenticated;

create policy "team members can access task_categories"
on task_categories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access checklist_template"
on checklist_template for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access tasks"
on tasks for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access email_tracker_items"
on email_tracker_items for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access checklist_progress"
on checklist_progress for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
