-- phase68_task_category_count_per_school.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn.
--
-- The "Show a Count column for this category" toggle (Tasks card > Edit
-- categories) used to be one flag on task_categories itself, so turning it
-- on/off applied to every school using that category at once. Michelle:
-- schools don't all track the same category the same way, so a school's
-- own Count setting shouldn't move any other school's. This table makes
-- that setting a per (school, category) pair instead -- present means "on"
-- for that school, absent means "off". task_categories.has_count is no
-- longer read by the app; left in place rather than dropped.

create table if not exists task_category_school_counts (
  school_id text not null references schools(id) on delete cascade,
  category_id text not null references task_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (school_id, category_id)
);

alter table task_category_school_counts enable row level security;

grant select, insert, update, delete on task_category_school_counts to authenticated;

drop policy if exists "team members can access task_category_school_counts" on task_category_school_counts;
create policy "team members can access task_category_school_counts"
on task_category_school_counts for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- Carries today's on/off state forward as each school's own starting
-- point, so nothing visually changes the moment this ships -- only
-- toggling it afterward is what becomes per-school.
insert into task_category_school_counts (school_id, category_id)
select s.id, c.id
from schools s
cross join task_categories c
where c.has_count = true
on conflict (school_id, category_id) do nothing;
