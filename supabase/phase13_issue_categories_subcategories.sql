-- Phase 13: Software Issue gets a manageable Category -> Subcategory
-- list (like Task Categories/Checklist template), plus a Subcategory
-- field on the issue itself. Requires Phase 1 (is_team_member()) to
-- already be applied.
-- Safe to run again even if it partly succeeded before -- every
-- statement below is idempotent (if not exists / drop-then-create).

create table if not exists issue_categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);
alter table issue_categories enable row level security;
drop policy if exists "team members can access issue_categories" on issue_categories;
create policy "team members can access issue_categories"
on issue_categories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create table if not exists issue_subcategories (
  id text primary key,
  category_id text not null references issue_categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
alter table issue_subcategories enable row level security;
drop policy if exists "team members can access issue_subcategories" on issue_subcategories;
create policy "team members can access issue_subcategories"
on issue_subcategories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

-- The issue itself just stores the chosen subcategory name as plain
-- text (same convention "category" already uses, and the same
-- convention Task's own category field uses) -- not a foreign key, so
-- an issue keeps its subcategory name even if it's later renamed or
-- removed from the list. issues.remarks already exists (added in
-- phase6) and becomes the Note field -- it was reserved but never
-- actually exposed in the UI until now.
alter table issues
  add column if not exists subcategory text not null default '';
