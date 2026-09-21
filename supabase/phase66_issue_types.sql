-- phase66_issue_types.sql — run once in Supabase's SQL Editor for project
-- jqsqstjmfsqqrnoxpuvn. Requires phase1 (is_team_member()) and the issues table.
--
-- Lets the team add their own kinds of Issues & Concerns next to the built-in
-- Software Issue, Correction/Verification and Charting Question:
--   * issue_types            one row per custom type (just a name)
--   * issues.custom_type_id  which custom type an issue belongs to (issues of a
--                            custom type are stored with type = 'custom')
-- A custom type can't be deleted while issues are filed under it.

create table if not exists issue_types (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists issue_types_name_unique on issue_types (lower(btrim(name)));

alter table issue_types enable row level security;

drop policy if exists "team members can access issue_types" on issue_types;
create policy "team members can access issue_types"
on issue_types for all
using (auth.uid() is not null and is_team_member())
with check (auth.uid() is not null and is_team_member());

grant select, insert, update, delete on issue_types to authenticated;
grant select on issue_types to service_role;

alter table issues add column if not exists custom_type_id text references issue_types(id) on delete restrict;

create index if not exists issues_custom_type_idx on issues (custom_type_id);
