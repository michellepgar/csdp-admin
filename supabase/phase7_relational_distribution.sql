-- phase7_relational_distribution.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, BEFORE the accompanying
-- backfill script and BEFORE the app code that reads these tables is
-- deployed. Requires Phase 1 (is_team_member()) to already be applied.

create table distribution_groups (
  id text primary key,
  name text not null,
  sort_order integer not null
);

create table distribution_rows (
  id text primary key,
  group_id text not null references distribution_groups(id) on delete cascade,
  school text not null,
  enrolled text,
  contact_person text,
  remarks text,
  -- Kept as JSON on purpose: a small fixed 3x3 classroom-type x
  -- language grid of numbers per row, not a concurrency hot spot the
  -- way Tasks/Email Tracker are -- same reasoning as the original
  -- design spec.
  breakdown jsonb not null default '{}'::jsonb,
  sort_order integer not null
);

alter table distribution_groups enable row level security;
alter table distribution_rows enable row level security;

grant select, insert, update, delete on distribution_groups to authenticated;
grant select, insert, update, delete on distribution_rows to authenticated;

create policy "team members can access distribution_groups"
on distribution_groups for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create policy "team members can access distribution_rows"
on distribution_rows for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());
