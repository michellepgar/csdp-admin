-- Phase 13: Software Issue gets a manageable Category -> Subcategory
-- list (like Task Categories/Checklist template), plus a Subcategory
-- field on the issue itself. Requires Phase 1 (is_team_member()) to
-- already be applied.
-- Run this once in the Supabase SQL Editor, then let Claude know
-- ("done") so the matching app code can be deployed.

create table issue_categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);
alter table issue_categories enable row level security;
create policy "team members can access issue_categories"
on issue_categories for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

create table issue_subcategories (
  id text primary key,
  category_id text not null references issue_categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
alter table issue_subcategories enable row level security;
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
